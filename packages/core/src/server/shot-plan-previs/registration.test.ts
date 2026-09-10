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

const timelineEnvelope = { frameRate: { numerator: 24, denominator: 1 }, frameCount: 240,
  segments: [{ id: 'wide', startFrame: 0, label: 'Wide' }], subjects: [{ key: 'speaker', label: 'Speaker', color: '#aAbB09' }] };

describe('Previs registration', () => {
  it('resolves exact recorded audio and localizes malformed references and retained-file escapes', async () => {
    const f = await fixture();
    await fs.writeFile(path.join(f.root, 'tmp/voice.wav'), 'recorded audio');
    const audio = await f.service.attachGenerationMedia({ ...f.input, purpose: 'shot-plan.dialogue-audio', target: { kind: 'shotPlan', id: f.input.shotPlanId }, turnRange: { start: 1, end: 1 },
      sourceProjectRelativePath: 'tmp/voice.wav', generationProvenance: { provider: 'fixture', model: 'audio', mediaKind: 'audio', prompt: null, request: {} } });
    const exactAudio = { assetId: audio.asset.id, assetFileId: audio.asset.files[0]!.id, offsetSeconds: 2 };
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'playback.json'), JSON.stringify({ ...timelineEnvelope, cues: [
      { id: 'voice', kind: 'dialogue', speaker: 'speaker', startFrame: 0, endFrame: 72, text: 'Voice', audio: exactAudio },
      { id: 'next', kind: 'dialogue', speaker: 'speaker', startFrame: 96, text: 'Still seekable', audio: { assetId: 5 } },
    ] }));
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'description.md'), 'Retained description');
    const first = (await f.service.registerShotPlanPrevis({ ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' })).revisions[0]!;
    expect((first.playback?.cues[0] as Extract<NonNullable<typeof first.playback>['cues'][number], { kind: 'dialogue' }>)?.audio).toEqual(exactAudio);
    expect(first.playback?.cues[1]).toEqual({ id: 'next', kind: 'dialogue', speaker: 'speaker', startFrame: 96, text: 'Still seekable' });
    const description = path.join(f.root, first.sourceDirectory, 'description.md');
    await fs.rename(description, `${description}.saved`);
    await fs.symlink(path.join(f.root, f.sourceDirectory, 'description.md'), description);
    const report = await f.service.readShotPlanPrevis(f.input);
    expect(report.revisions[0]).toMatchObject({ description: null, render: expect.any(Object), warnings: expect.arrayContaining([expect.objectContaining({ code: 'CORE_PREVIS_DISPLAY_UNAVAILABLE' })]) });
    const audioPath = path.join(f.root, audio.asset.files[0]!.projectRelativePath);
    await fs.rename(audioPath, `${audioPath}.saved`);
    expect((await f.service.readShotPlanPrevis(f.input)).revisions[0]?.playback?.cues[0]).not.toHaveProperty('audio');
  });

  it('reads typed revision display and rejects invalid supplied timelines before registration', async () => {
    const f = await fixture();
    const description = '# Camera\n\nHold **the exchange**.\n';
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'description.md'), description);
    const playback = {
      ...timelineEnvelope,
      cues: [
        { id: 'a', kind: 'action', startFrame: 24, subject: 'speaker', text: '' },
        { id: 'b', kind: 'camera', startFrame: 48, text: 'A point' },
        { id: 'c', kind: 'dialogue', speaker: 'speaker', startFrame: 72, endFrame: 120, text: 'Line', audio: { assetId: 'missing', assetFileId: 'missing' } },
      ],
    };
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'playback.json'), JSON.stringify(playback));
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = (await f.service.registerShotPlanPrevis(request)).revisions[0]!;
    expect(first.description).toBe(description);
    expect(first.playback?.subjects).toEqual(playback.subjects);
    expect(first.playback?.cues).toEqual([playback.cues[0], playback.cues[1], { id: 'c', kind: 'dialogue', speaker: 'speaker', startFrame: 72, endFrame: 120, text: 'Line' }]);
    expect(first.warnings).toEqual([expect.objectContaining({ code: 'CORE_PREVIS_AUDIO_UNAVAILABLE', location: { path: ['playback', 'cues', '2', 'audio'] } })]);
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'description.md'), 'Later direction');
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'playback.json'), JSON.stringify({ ...timelineEnvelope, cues: [{ kind: 'camera', id: 'invalid', startFrame: -1, text: 'x' }] }));
    await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({ code: 'CORE_PREVIS_PLAYBACK_INVALID' });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toHaveLength(1);
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'playback.json'), JSON.stringify({ ...timelineEnvelope, cues: [] }));
    const second = (await f.service.registerShotPlanPrevis(request)).revisions;
    expect(second[0]?.description).toBe(description);
    expect(second[1]).toMatchObject({ description: 'Later direction', warnings: [] });
    await fs.writeFile(path.join(f.root, second[1]!.sourceDirectory, 'playback.json'), '{');
    expect((await f.service.readShotPlanPrevis(f.input)).revisions[1]).toMatchObject({ playback: null, render: expect.any(Object), warnings: [expect.objectContaining({ code: 'CORE_PREVIS_PLAYBACK_INVALID' })] });
    const cards = await f.service.listSceneShotPlans({ ...f.input, sceneId: f.plan.shotPlan.sceneId });
    expect(cards.shotPlans.find((entry) => entry.shotPlan.id === f.input.shotPlanId)?.previsRender?.id).toBe(second[1]?.render?.id);
  });

  it('pairs only explicit exact revisions, rejects cross-plan context before writes and retains independent take lifecycle', async () => {
    const f = await fixture();
    const revision = (await f.service.registerShotPlanPrevis({ ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' })).revisions[0]!;
    const other = await f.service.createShotPlan({ ...f.input, type: 'previs', sceneId: f.plan.shotPlan.sceneId, title: 'Other', coverage: null, shots: [] });
    const input = { ...f.input, purpose: 'shot-plan.video-generation' as const, target: { kind: 'shotPlan' as const, id: f.input.shotPlanId },
      sourceProjectRelativePath: 'tmp/previs.mp4', generationProvenance: { provider: 'test', model: 'video', mediaKind: 'video' as const, prompt: 'Opaque', request: { prompt: 'Opaque' } } };
    await expect(f.service.attachGenerationMedia({ ...input, target: { kind: 'shotPlan', id: other.shotPlan.id }, previsRevisionId: revision.id })).rejects.toMatchObject({ code: 'CORE_PREVIS_GENERATION_SOURCE_INVALID' });
    const unpaired = await f.service.attachGenerationMedia(input);
    const paired = await f.service.attachGenerationMedia({ ...input, previsRevisionId: revision.id, title: 'Take one' });
    const second = await f.service.attachGenerationMedia({ ...input, previsRevisionId: revision.id, title: 'Take two' });
    expect(paired.asset.authoredFrom).toEqual({ kind: 'shotPlan', id: f.input.shotPlanId, previsRevisionId: revision.id });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions[0]?.generations.map((asset) => asset.id)).toEqual([second.asset.id, paired.asset.id]);
    await f.service.discardAsset({ ...f.input, assetId: paired.asset.id, owner: { kind: 'project' } });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions[0]?.generations).toHaveLength(1);
    await f.service.restoreAsset({ ...f.input, assetId: paired.asset.id });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions[0]?.generations).toHaveLength(2);
    const edited = await f.service.attachGenerationMedia({ ...input, purpose: 'video.edit', target: { kind: 'asset', id: paired.asset.id }, generationProvenance: {
      ...input.generationProvenance, request: { references: [{ $file: paired.asset.files[0]!.projectRelativePath, mimeType: 'video/mp4', reviewLabel: 'Source' }] },
    } });
    expect(edited.asset.authoredFrom).toEqual(paired.asset.authoredFrom);
    expect((await f.service.readShotPlanPrevis(f.input)).revisions[0]?.generations.map((asset) => asset.id)).not.toContain(unpaired.asset.id);
  });

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
    expect(JSON.stringify(context.suggestedReferences)).toContain(revision.render!.id);
    const generations = await f.service.listSceneShotPlanVideoGenerations({ ...f.input, sceneId: f.plan.shotPlan.sceneId });
    expect(JSON.stringify(generations)).not.toContain(revision.render!.id);
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'build_previs.py'), '# changed geometry and timing');
    // Creative extensions are retained exactly without driving playback.
    await fs.writeFile(path.join(f.root, f.sourceDirectory, 'playback.json'), JSON.stringify({ ...timelineEnvelope, cues: [], custom: 'director note' }));
    const second = await f.service.registerShotPlanPrevis(request);
    expect(second.revisions).toHaveLength(2);
    expect(await fs.readFile(path.join(f.root, revision.sourceDirectory, 'build_previs.py'), 'utf8')).toBe('# scene-specific source');
    await f.service.cleanProjectTemporaryFiles(f.input);
    expect(await fs.readFile(path.join(f.root, second.revisions[1]!.sourceDirectory, 'playback.json'), 'utf8')).toBe(JSON.stringify({ ...timelineEnvelope, cues: [], custom: 'director note' }));
    for (const retained of second.revisions) {
      expect(await fs.readFile(path.join(f.root, retained.render!.files[0]!.projectRelativePath), 'utf8')).toBe('procedural video fixture');
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
        .where(eq(assetFiles.assetId, registered.revisions[0]!.render!.id)).run();
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
    const renderPath = path.join(f.root, registered.revisions[0]!.render!.files[0]!.projectRelativePath);
    const linkedPath = linkKind === 'directory' ? path.dirname(renderPath) : renderPath;
    const target = path.join(f.root, 'tmp', path.basename(linkedPath));
    await fs.rename(linkedPath, target);
    await fs.symlink(target, linkedPath);
    await expect(f.service.cleanProjectTemporaryFiles(f.input)).rejects.toMatchObject({
      code: 'CORE_PROJECT_TMP_REGISTERED_ASSET',
      message: expect.stringContaining(registered.revisions[0]!.render!.files[0]!.projectRelativePath),
    });
    expect(await fs.readFile(renderPath, 'utf8')).toBe('procedural video fixture');
    expect(await fs.readFile(path.join(f.root, 'tmp/previs.mp4'), 'utf8')).toBe('procedural video fixture');
  });

  it('requires restoring a discarded render before an identical retry succeeds', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = await f.service.registerShotPlanPrevis(request);
    const assetId = first.revisions[0]!.render!.id;
    await f.service.discardAsset({ ...f.input, assetId, owner: { kind: 'project' } });
    await expect(f.service.registerShotPlanPrevis(request)).rejects.toMatchObject({
      code: 'CORE_PREVIS_REVISION_RENDER_UNAVAILABLE',
      message: expect.stringContaining(assetId),
      suggestion: expect.stringContaining('Restore the render Asset from Trash'),
    });
    expect((await f.service.readShotPlanPrevis(f.input)).revisions).toEqual([expect.objectContaining({ id: first.revisions[0]!.id, render: null })]);
    await f.service.restoreAsset({ ...f.input, assetId });
    const retried = await f.service.registerShotPlanPrevis(request);
    expect(retried.revisions).toHaveLength(1);
    expect(retried.revisions[0]!.id).toBe(first.revisions[0]!.id);
  });

  it('allows cleanup when a registered file outside tmp is already missing', async () => {
    const f = await fixture();
    const first = await f.service.registerShotPlanPrevis({ ...f.input,
      sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' });
    const renderPath = path.join(f.root, first.revisions[0]!.render!.files[0]!.projectRelativePath);
    await fs.rename(renderPath, `${renderPath}.saved`);
    await f.service.cleanProjectTemporaryFiles(f.input);
    expect(await fs.readdir(path.join(f.root, 'tmp'))).toEqual([]);
    expect(await fs.readFile(`${renderPath}.saved`, 'utf8')).toBe('procedural video fixture');
  });

  it('rejects an identical retry when the retained render file is missing and succeeds once restored', async () => {
    const f = await fixture();
    const request = { ...f.input, sourceDirectory: f.sourceDirectory, renderPath: 'tmp/previs.mp4' };
    const first = await f.service.registerShotPlanPrevis(request);
    const renderPath = path.join(f.root, first.revisions[0]!.render!.files[0]!.projectRelativePath);
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
        .where(eq(assetFiles.id, first.revisions[0]!.render!.files[0]!.id)).run();
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
