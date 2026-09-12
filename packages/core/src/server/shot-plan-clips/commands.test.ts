import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

async function fixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-clips-'));
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const service = createProjectDataService();
  const created = await createSampleMovieProject({ projectData: service, homeDir });
  if (!created) {
    throw new Error('SQLite fixture unavailable');
  }
  const project = { homeDir, projectName: 'constantinople' };
  const scene = (await service.readScreenplayStructure(project)).screenplay.scenes[0]!;
  const plan = await service.createShotPlan({ ...project, type: 'previs', sceneId: scene.id, title: 'Gate', coverage: null, shots: [] });
  const input = { ...project, shotPlanId: plan.shotPlan.id };
  const sourceDirectory = (await service.readShotPlanPrevis(input)).sourceDirectory;
  await fs.mkdir(path.join(created.projectPath, sourceDirectory), { recursive: true });
  await fs.writeFile(path.join(created.projectPath, sourceDirectory, 'scene.blend'), 'source envelope');
  await fs.writeFile(path.join(created.projectPath, 'raw.mp4'), 'video envelope');
  let version = 0;
  const register = async () => {
    await fs.writeFile(path.join(created.projectPath, sourceDirectory, 'description.md'), `Direction ${++version}`);
    return service.registerShotPlanPrevis({ ...input, sourceDirectory, renderPath: 'raw.mp4' });
  };
  const revision = (await register()).revisions[0]!;
  const scope = { ...input, previsRevisionId: revision.id };
  const attach = (clipId?: string, sourceTakeId?: string) => service.attachGenerationMedia({
    ...project, purpose: 'shot-plan.video-generation', target: clipId ? undefined : { kind: 'shotPlan', id: input.shotPlanId },
    sourceProjectRelativePath: 'raw.mp4', clipId, sourceTakeId, previsRevisionId: clipId ? undefined : revision.id,
    generationProvenance: { provider: 'fixture', model: 'video', mediaKind: 'video', prompt: 'Opaque', request: {} },
  });
  return { service, project, input, scope, register, attach };
}

it('allocates stable identities, resolves exact scope, keeps browsing separate and clears discarded selections', async () => {
  const f = await fixture();
  const first = (await f.service.createShotPlanClip(f.scope)).clips[0]!;
  const second = (await f.service.createShotPlanClip(f.scope)).clips[1]!;
  const video = await f.attach(first.id);
  let report = await f.service.readShotPlanClips(f.scope);
  const take = report.clips[0]!.takes[0]!;
  expect(take).toMatchObject({ number: 1, title: null, sourceTakeId: null, assetId: video.asset.id });
  expect(report.clips[0]!.selectedTakeId).toBeNull();
  expect(await f.service.resolveShotPlanClipTake({ ...f.scope, clipNumber: 1, takeNumber: 1 })).toEqual(take);
  await f.service.registerShotPlanClipTake({ ...f.project, clipId: first.id, assetId: take.assetId, assetFileId: take.assetFileId });
  expect((await f.service.readShotPlanClips(f.scope)).clips[0]!.takes).toHaveLength(1);
  await expect(f.service.registerShotPlanClipTake({ ...f.project, clipId: second.id, assetId: take.assetId, assetFileId: take.assetFileId })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_CLIP_FILE_ALREADY_ASSIGNED' });
  await expect(f.service.selectShotPlanClipTake({ ...f.project, clipId: second.id, takeId: take.id })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_CLIP_SELECTION_INVALID' });
  await f.service.selectShotPlanClipTake({ ...f.project, clipId: first.id, takeId: take.id });
  await f.attach(second.id, take.id);
  await f.service.discardAsset({ ...f.project, assetId: take.assetId, owner: { kind: 'project' } });
  report = await f.service.readShotPlanClips(f.scope);
  expect(report.clips[0]!.selectedTakeId).toBeNull();
  expect(report.clips[1]!.takes[0]!.sourceTakeId).toBe(take.id);
  await expect(f.service.selectShotPlanClipTake({ ...f.project, clipId: first.id, takeId: take.id })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_CLIP_TAKE_INVALID' });
  await f.service.restoreAsset({ ...f.project, assetId: take.assetId });
  expect((await f.service.readShotPlanClips(f.scope)).clips[0]!.selectedTakeId).toBeNull();
  await f.attach(first.id);
  expect((await f.service.readShotPlanClips(f.scope)).clips[0]!.takes.map((entry) => entry.number)).toEqual([1, 2]);
});

it('preserves unassigned files, rejects invalid attachments atomically and accepts cross-revision source attribution', async () => {
  const f = await fixture();
  const first = (await f.service.createShotPlanClip(f.scope)).clips[0]!;
  const unassigned = await f.attach();
  expect((await f.service.readShotPlanClips(f.scope)).unassignedAssets.map((asset) => asset.id)).toContain(unassigned.asset.id);
  await f.attach(first.id);
  const take = (await f.service.readShotPlanClips(f.scope)).clips[0]!.takes[0]!;
  const nextRevision = (await f.register()).revisions.at(-1)!;
  const nextScope = { ...f.input, previsRevisionId: nextRevision.id };
  const next = (await f.service.createShotPlanClip(nextScope)).clips[0]!;
  await expect(f.attach(next.id, 'missing')).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_CLIP_TAKE_NOT_FOUND' });
  expect((await f.service.readShotPlanClips(nextScope)).assets).toHaveLength(0);
  await f.attach(next.id, take.id);
  const report = await f.service.readShotPlanClips(nextScope);
  expect(report.clips[0]!.takes[0]!.sourceTakeId).toBe(take.id);
  expect(report.sources[0]).toMatchObject({ revisionNumber: 1, clipNumber: 1, takeNumber: 1 });
  await f.service.updateShotPlanClipTake({ ...f.project, takeId: take.id, title: 'Initial' });
  expect((await f.service.resolveShotPlanClipTake({ ...f.scope, clipNumber: 1, takeNumber: 1 })).title).toBe('Initial');
  await expect(f.service.resolveShotPlanClipTake({ ...f.scope, clipNumber: 1.5, takeNumber: 1 })).rejects.toMatchObject({ code: 'CORE_SHOT_PLAN_CLIP_TAKE_INVALID' });
});
