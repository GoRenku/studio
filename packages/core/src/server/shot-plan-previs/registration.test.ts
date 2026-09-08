import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { openProjectStore } from '../database/lifecycle/store.js';
import { assetFiles } from '../schema/assets.js';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

async function fixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-previs-'));
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const service = createProjectDataService();
  const created = await createSampleMovieProject({ projectData: service, homeDir });
  if (!created) {
    throw new Error('SQLite fixture unavailable');
  }
  const project = { homeDir, projectName: 'constantinople' };
  const screenplay = await service.readScreenplayStructure(project);
  const plan = await service.createShotPlan({ ...project, type: 'previs',
    sceneId: screenplay.screenplay.scenes[0]!.id, title: 'Gate approach', coverage: null, shots: [] });
  const input = { ...project, shotPlanId: plan.shotPlan.id };
  const report = await service.readShotPlanPrevis(input);
  const sourceDirectory = report.sourceDirectory;
  await fs.mkdir(path.join(created.projectPath, sourceDirectory), { recursive: true });
  await fs.writeFile(path.join(created.projectPath, sourceDirectory, 'build_previs.py'), '# scene-specific source');
  await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
  // File-envelope fixture; media playback is exercised separately in authoring evals.
  await fs.writeFile(path.join(created.projectPath, 'tmp/previs.mp4'), 'procedural video fixture');
  return { service, input, sourceDirectory, root: created.projectPath, plan };
}

describe('Previs registration', () => {
  it('retains exact source revisions, registers procedural media and deduplicates retries', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = await f.service.registerShotPlanPrevis(request);
    expect(first.revisions).toHaveLength(1);
    const revision = first.revisions[0]!;
    expect(revision.sourceDirectory).toMatch(/previs\/revisions\/r001$/);
    expect(revision.render).toMatchObject({ type: 'shot_plan_previs', mediaKind: 'video', origin: 'rendered' });
    expect(JSON.stringify(revision.render)).toContain('previs/renders/previs-g');
    expect(await f.service.registerShotPlanPrevis(request)).toEqual(first);
    const context = await f.service.readMediaGenerationContext({ ...f.input,
      purpose: 'shot-plan.video-generation', target: { kind: 'shotPlan', id: f.input.shotPlanId } });
    expect(JSON.stringify(context.suggestedReferences)).toContain(revision.render.id);
    const generations = await f.service.listSceneShotPlanVideoGenerations({ ...f.input, sceneId: f.plan.shotPlan.sceneId });
    expect(JSON.stringify(generations)).not.toContain(revision.render.id);
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'build_previs.py'), '# changed geometry and timing');
    // Playback content is opaque, including locally chosen keys and incomplete annotations.
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'playback.json'), '{"custom":"director note"}');
    const second = await f.service.registerShotPlanPrevis(request);
    expect(second.revisions).toHaveLength(2);
    expect(await fs.readFile(path.join(f.root, revision.sourceDirectory, 'build_previs.py'), 'utf8')).toBe('# scene-specific source');
    await f.service.cleanProjectTemporaryFiles(f.input);
    expect(await fs.readFile(path.join(f.root, second.revisions[1]!.sourceDirectory, 'playback.json'), 'utf8')).toBe('{"custom":"director note"}');
    for (const retained of second.revisions) {
      expect(await fs.readFile(path.join(f.root, retained.render.files[0]!.projectRelativePath), 'utf8')).toBe('procedural video fixture');
    }
    expect(await fs.readdir(path.join(f.root, 'tmp'))).toEqual([]);
  });

  it('refuses cleanup before deleting anything when an AssetFile points into tmp', async () => {
    const f = await fixture();
    const registered = await f.service.registerShotPlanPrevis({ ...f.input,
      sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' });
    const session = openProjectStore({ projectFolder: f.root, create: false });
    try {
      session.db.update(assetFiles).set({ projectRelativePath: 'tmp/previs.mp4' })
        .where(eq(assetFiles.assetId, registered.revisions[0]!.render.id)).run();
    } finally {
      session.close();
    }
    await expect(f.service.cleanProjectTemporaryFiles(f.input)).rejects.toMatchObject({ code: 'CORE_PROJECT_TMP_REGISTERED_ASSET' });
    expect(await fs.readFile(path.join(f.root, 'tmp/previs.mp4'), 'utf8')).toBe('procedural video fixture');
  });

  it('rejects source escapes and leaves no revision after a failed registration', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: '../outside', renderPath: 'tmp/previs.mp4' };
    await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({ code: 'PROJECT_DATA060' });
    await fs.symlink('/tmp', path.join(f.root, f.sourceDirectory, 'external'));
    await expect(f.service.registerShotPlanPrevis({ ...request, sourceDirectory: f.sourceDirectory })).rejects.toMatchObject({ code: 'CORE_PREVIS_SOURCE_INVALID' });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toEqual([]);
  });

  it.each(['renders', 'revisions'])('rejects a retained %s directory linked into tmp before registering', async (directory) => {
    const f = await fixture();
    const target = path.join(f.root, 'tmp', directory);
    await fs.mkdir(target);
    await fs.symlink(target, path.join(f.root, f.sourceDirectory, '..', directory));
    await expect(f.service.registerShotPlanPrevis({ ...f.input,
      sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' })).rejects.toMatchObject({
      code: 'PROJECT_ASSET_FILE_DESTINATION_FORBIDDEN',
    });
    expect(await fs.readdir(target)).toEqual([]);
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toEqual([]);
    expect(await fs.readFile(path.join(f.root, 'tmp/previs.mp4'), 'utf8')).toBe('procedural video fixture');
  });

  it.each(['directory', 'file'])('refuses cleanup when a registered render resolves into tmp through a %s link', async (linkKind) => {
    const f = await fixture();
    const registered = await f.service.registerShotPlanPrevis({ ...f.input,
      sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' });
    const renderPath = path.join(f.root, registered.revisions[0]!.render.files[0]!.projectRelativePath);
    const linkedPath = linkKind === 'directory' ? path.dirname(renderPath) : renderPath;
    const target = path.join(f.root, 'tmp', path.basename(linkedPath));
    await fs.rename(linkedPath, target);
    await fs.symlink(target, linkedPath);
    await expect(f.service.cleanProjectTemporaryFiles(f.input)).rejects.toMatchObject({
      code: 'CORE_PROJECT_TMP_REGISTERED_ASSET',
      message: expect.stringContaining(registered.revisions[0]!.render.files[0]!.projectRelativePath),
    });
    expect(await fs.readFile(renderPath, 'utf8')).toBe('procedural video fixture');
    expect(await fs.readFile(path.join(f.root, 'tmp/previs.mp4'), 'utf8')).toBe('procedural video fixture');
  });

  it('requires restoring a discarded render before an identical retry succeeds', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = await f.service.registerShotPlanPrevis(request);
    const assetId = first.revisions[0]!.render.id;
    await f.service.discardAsset({ ...f.input, assetId, owner: { kind: 'project' } });
    await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({
      code: 'CORE_PREVIS_REVISION_RENDER_UNAVAILABLE',
      message: expect.stringContaining(assetId),
      suggestion: expect.stringContaining('Restore the render Asset from Trash'),
    });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toEqual([]);
    await f.service.restoreAsset({ ...f.input, assetId });
    const retried = await f.service.registerShotPlanPrevis(request);
    expect(retried.revisions).toHaveLength(1);
    expect(retried.revisions[0]!.id).toBe(first.revisions[0]!.id);
  });

  it('allows cleanup when a registered file outside tmp is already missing', async () => {
    const f = await fixture();
    const first = await f.service.registerShotPlanPrevis({ ...f.input,
      sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' });
    const renderPath = path.join(f.root, first.revisions[0]!.render.files[0]!.projectRelativePath);
    await fs.rename(renderPath, `${renderPath}.saved`);
    await f.service.cleanProjectTemporaryFiles(f.input);
    expect(await fs.readdir(path.join(f.root, 'tmp'))).toEqual([]);
    expect(await fs.readFile(`${renderPath}.saved`, 'utf8')).toBe('procedural video fixture');
  });

  it('rejects an identical retry when the retained render file is missing and succeeds once restored', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = await f.service.registerShotPlanPrevis(request);
    const renderPath = path.join(f.root, first.revisions[0]!.render.files[0]!.projectRelativePath);
    await fs.rename(renderPath, `${renderPath}.saved`);
    await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({
      code: 'CORE_PREVIS_REVISION_RENDER_UNAVAILABLE',
      suggestion: expect.stringContaining('Restore the retained render file'),
    });
    await fs.rename(`${renderPath}.saved`, renderPath);
    expect(await f.service.registerShotPlanPrevis(request)).toEqual(first);
  });

  it('rejects an identical retry when the primary render file is discarded', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = await f.service.registerShotPlanPrevis(request);
    const session = openProjectStore({ projectFolder: f.root, create: false });
    try {
      session.db.update(assetFiles).set({ discardedAt: new Date().toISOString() })
        .where(eq(assetFiles.id, first.revisions[0]!.render.files[0]!.id)).run();
    } finally {
      session.close();
    }
    await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({ code: 'CORE_PREVIS_REVISION_RENDER_UNAVAILABLE' });
  });

  it('keeps Shot List authoring separate from Previs authoring', async () => {
    const f = await fixture();
    await expect(f.service.addShotToPlan({ ...f.input, shot: { title: 'Wrong representation', description: '', brief: {} } })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_TYPE_INVALID' });
    await expect(f.service.validateShotPlanDocument({ document: {
      kind: 'shotPlanCreate', type: 'previs', sceneId: f.plan.shotPlan.sceneId, title: 'Previs', coverage: null,
      shots: [{ title: 'Not a list', description: '', brief: {} }],
    } })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_INVALID' });
  });

  it('rejects a linked render destination before creating files outside the project', async () => {
    const f = await fixture();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'previs-outside-'));
    const renders = path.join(f.root, f.sourceDirectory, '..', 'renders');
    await fs.symlink(outside, renders);
    await expect(f.service.registerShotPlanPrevis({ ...f.input,
      sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' })).rejects.toMatchObject({ code: 'PROJECT_ASSET_FILE_PATH_OUTSIDE_PROJECT' });
    expect(await fs.readdir(outside)).toEqual([]);
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toEqual([]);
  });

  it('rolls back source and Asset writes when video persistence fails, allowing a retry', async () => {
    const f = await fixture();
    const copy = fsSync.copyFileSync.bind(fsSync);
    const fault = vi.spyOn(fsSync, 'copyFileSync').mockImplementation((source, target, mode) => {
      if (String(target).includes('/renders/')) {
        throw new Error('Simulated media copy failure');
      }
      copy(source, target, mode);
    });
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    try {
      await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({ code: 'PROJECT_ASSET_FILE_DESTINATION_WRITE_FAILED' });
    } finally {
      fault.mockRestore();
    }
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toEqual([]);
    expect((await f.service.registerShotPlanPrevis(request)).revisions[0]!.number).toBe(1);
  });
});
