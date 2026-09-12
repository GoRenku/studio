import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { readMediaGenerationReferenceProjectFile } from '../media-generation-review/local-media.js';

async function fixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-plan-references-'));
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const service = createProjectDataService();
  const created = await createSampleMovieProject({ projectData: service, homeDir });
  if (!created) {
    throw new Error('SQLite fixture unavailable');
  }
  const project = { homeDir, projectName: 'constantinople' };
  const screenplay = await service.readScreenplayStructure(project);
  const plan = await service.createShotPlan({ ...project, type: 'previs',
    sceneId: screenplay.screenplay.scenes[0]!.id, title: 'Council', coverage: null, shots: [] });
  const input = { ...project, shotPlanId: plan.shotPlan.id };
  const root = created.projectPath;
  const { sourceDirectory } = await service.readShotPlanPrevis(input);
  await fs.mkdir(path.join(root, sourceDirectory), { recursive: true });
  await fs.writeFile(path.join(root, sourceDirectory, 'build_previs.py'), '# fixture');
  await fs.mkdir(path.join(root, 'tmp/operations/media-generation'), { recursive: true });
  await fs.writeFile(path.join(root, 'tmp/previs.mp4'), 'video envelope');
  const revision = (await service.registerShotPlanPrevis({ ...input, sourceDirectory, renderPath: 'tmp/previs.mp4' })).revisions[0]!;
  return { service, input: { ...input, previsRevisionId: revision.id }, root, sceneId: plan.shotPlan.sceneId };
}

afterEach(() => vi.restoreAllMocks());

describe('prepared Shot Plan references', () => {
  it.each([['image', 'png', 'image/png'], ['video', 'mp4', 'video/mp4'], ['audio', 'wav', 'audio/wav']] as const)(
    'registers %s durably, previews the exact bytes, and restores through Trash', async (mediaKind, extension, mimeType) => {
      const f = await fixture();
      const sourceProjectRelativePath = `tmp/reference.${extension}`;
      await fs.writeFile(path.join(f.root, sourceProjectRelativePath), 'exact opaque reference');
      const input = { ...f.input, sourceProjectRelativePath, mediaKind, title: 'Continuation reference', summary: 'Exact source frame or interval.' };
      const report = await f.service.importShotPlanReference(input);
      const file = report.asset.files[0]!;
      expect(report.asset).toMatchObject({ owner: { kind: 'project' }, type: 'shot_plan_video_reference', mediaKind,
        generationProvenance: null, origin: 'external', oneLineSummary: input.summary,
        authoredFrom: { kind: 'shotPlan', id: input.shotPlanId, previsRevisionId: input.previsRevisionId } });
      expect(file).toMatchObject({ role: 'primary', mimeType });
      expect(file.projectRelativePath).toMatch(/^scenes\/[^/]+\/\d+-shot-plan\//);
      expect(await fs.readFile(path.join(f.root, sourceProjectRelativePath), 'utf8')).toBe('exact opaque reference');
      const served = await readMediaGenerationReferenceProjectFile({ ...f.input, projectRelativePath: file.projectRelativePath });
      expect(served.mimeType).toBe(mimeType);
      expect(await fs.readFile(served.absolutePath, 'utf8')).toBe('exact opaque reference');
      const documentPath = 'tmp/operations/media-generation/request.json';
      await fs.writeFile(path.join(f.root, documentPath), JSON.stringify({ provider: 'fixture', model: 'reference', mediaKind: 'video', prompt: null,
        request: { input: { $file: file.projectRelativePath, mimeType, reviewLabel: 'Continuation' } } }));
      const preview = await f.service.readMediaGenerationPreview({ ...f.input, documentPath });
      expect(preview.references[0]).toMatchObject({ available: true, kind: mediaKind });
      expect(preview.diagnostics).toEqual([]);
      const second = await f.service.importShotPlanReference(input);
      expect(second.asset.files[0]!.projectRelativePath).not.toBe(file.projectRelativePath);
      expect((await f.service.readShotPlanAssets(f.input)).groups[0]?.assets).toHaveLength(2);
      expect((await f.service.readShotPlanPrevis(f.input)).revisions[0]?.clips.unassignedAssets).toEqual([]);
      await f.service.discardShotPlanAsset({ ...f.input, assetId: report.asset.id });
      expect((await f.service.readMediaGenerationPreview({ ...f.input, documentPath })).references[0]?.available).toBe(false);
      const restored = await f.service.restoreAsset({ ...f.input, assetId: report.asset.id });
      expect(restored.resourceKeys).toContain(`surface:shotPlan:${f.input.shotPlanId}:assets`);
      expect((await f.service.readMediaGenerationPreview({ ...f.input, documentPath })).references[0]?.available).toBe(true);
    },
  );

  it('rejects invalid scope and file envelopes before creating Assets', async () => {
    const f = await fixture();
    await fs.writeFile(path.join(f.root, 'tmp/frame.png'), 'image envelope');
    const input = { ...f.input, sourceProjectRelativePath: 'tmp/frame.png', mediaKind: 'image' as const, title: 'Frame' };
    const other = await f.service.createShotPlan({ ...f.input, type: 'previs', sceneId: f.sceneId, title: 'Other', coverage: null, shots: [] });
    for (const patch of [
      { previsRevisionId: undefined }, { previsRevisionId: 'missing' }, { shotPlanId: other.shotPlan.id },
      { shotPlanId: 'missing' }, { title: '' }, { mediaKind: 'audio' as const },
      { sourceProjectRelativePath: '../outside.png' }, { sourceProjectRelativePath: 'tmp/absent.png' },
      { sourceProjectRelativePath: 'tmp/file.exe' },
    ]) {
      await expect(f.service.importShotPlanReference({ ...input, ...patch })).rejects.toHaveProperty('code');
    }
    const outside = path.join(f.input.homeDir, 'outside.png');
    await fs.writeFile(outside, 'outside');
    await fs.symlink(outside, path.join(f.root, 'tmp/escape.png'));
    await expect(f.service.importShotPlanReference({ ...input, sourceProjectRelativePath: 'tmp/escape.png' })).rejects.toHaveProperty('code');
    expect((await f.service.readShotPlanAssets(f.input)).groups).toEqual([]);
  });

  it('rolls back a failed copy without deleting the prepared source', async () => {
    const f = await fixture();
    await fs.writeFile(path.join(f.root, 'tmp/frame.png'), 'frame');
    vi.spyOn(fsSync, 'copyFileSync').mockImplementation(() => { throw new Error('disk write failed'); });
    await expect(f.service.importShotPlanReference({ ...f.input, sourceProjectRelativePath: 'tmp/frame.png', mediaKind: 'image', title: 'Frame' })).rejects.toHaveProperty('code');
    expect((await f.service.readShotPlanAssets(f.input)).groups).toEqual([]);
    expect(await fs.readFile(path.join(f.root, 'tmp/frame.png'), 'utf8')).toBe('frame');
  });

  it('retains revision attribution through generated image references and image edits', async () => {
    const f = await fixture();
    await fs.writeFile(path.join(f.root, 'tmp/frame.png'), 'frame');
    const input = { ...f.input, purpose: 'shot-plan.video-reference' as const, target: { kind: 'shotPlan' as const, id: f.input.shotPlanId }, sourceProjectRelativePath: 'tmp/frame.png' };
    await expect(f.service.attachGenerationMedia(input)).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED' });
    const generationProvenance = { provider: 'fixture', model: 'image', mediaKind: 'image' as const, prompt: null, request: {} };
    const generated = await f.service.attachGenerationMedia({ ...input, generationProvenance });
    const edit = await f.service.attachGenerationMedia({ ...f.input, previsRevisionId: undefined, purpose: 'image.edit', target: { kind: 'asset', id: generated.asset.id }, sourceProjectRelativePath: 'tmp/frame.png',
      generationProvenance: { ...generationProvenance, request: { input: { $file: generated.asset.files[0]!.projectRelativePath, reviewLabel: 'Exact source' } } } });
    expect(edit.asset.authoredFrom).toEqual(generated.asset.authoredFrom);
  });
});
