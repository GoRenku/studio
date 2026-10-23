import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { readShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { openCurrentProject } from '../project-selection/index.js';
import {
  createBlankMovieProject,
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { statusFromProgress } from './stage-status.js';

describe('production path', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-production-path-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('starts a blank project at the screenplay with every stage not started', async () => {
    const created = await createBlankMovieProject({ homeDir, projectData });
    const resource = await projectData.readProductionPathResource({
      homeDir,
      projectName: created!.projectName,
    });
    expect(resource.stages.map((stage) => stage.id)).toEqual([
      'screenplay',
      'screenplayAnalysis',
      'castAndSets',
      'visualLanguage',
      'castAndSetVisuals',
      'sceneBeats',
      'shotPlans',
      'videoTakes',
    ]);
    expect(resource.stages.every((stage) => stage.status === 'notStarted')).toBe(true);
    expect(resource.nextStageId).toBe('screenplay');
  });

  it('moves to the analysis once the screenplay, cast and a location exist', async () => {
    await createSampleMovieProject({ homeDir, projectData });
    await openCurrentProject({ projectName: 'constantinople', homeDir });
    const resource = await projectData.readProductionPathResource({
      homeDir,
      projectName: 'constantinople',
    });
    const stage = (id: string) => resource.stages.find((entry) => entry.id === id);
    expect(stage('screenplay')).toMatchObject({ status: 'complete' });
    expect(stage('screenplay')?.progress?.total).toBeGreaterThan(0);
    expect(stage('screenplayAnalysis')).toMatchObject({ status: 'notStarted', progress: null });
    expect(stage('castAndSets')).toMatchObject({ status: 'complete' });
    expect(stage('sceneBeats')).toMatchObject({
      status: 'notStarted',
      progress: { done: 0, total: stage('screenplay')?.progress?.total },
    });
    expect(resource.nextStageId).toBe('screenplayAnalysis');
  });

  it('derives status from progress', () => {
    expect(statusFromProgress({ done: 0, total: 0 })).toBe('notStarted');
    expect(statusFromProgress({ done: 0, total: 4 })).toBe('notStarted');
    expect(statusFromProgress({ done: 2, total: 4 })).toBe('started');
    expect(statusFromProgress({ done: 4, total: 4 })).toBe('complete');
  });

  it('counts only the active revision when the last Beat is deleted or restored', async () => {
    await createSampleMovieProject({ homeDir, projectData });
    const input = { homeDir, projectName: 'constantinople' };
    const screenplay = await projectData.readScreenplayStructure(input);
    const scene = screenplay.screenplay.scenes[0]!;
    const initial = await projectData.createSceneBeatsRevision({
      homeDir,
      document: {
        sceneId: scene.id,
        beats: [{
          title: 'Map study',
          description: 'Mehmed studies the map.',
          narrativeDevelopment: 'The plan hardens.',
          narrativePurpose: 'Establish the strategy.',
          screenplayBlockIds: [scene.blocks[0]!.id],
          castMemberIds: [],
          locationIds: [],
          propIds: [],
        }],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    const revision = await projectData.readSceneBeatsRevision({ homeDir, revisionId: initial.revision.id });
    const readStage = async () => (await projectData.readProductionPathResource(input))
      .stages.find((stage) => stage.id === 'sceneBeats');
    expect(await readStage()).toMatchObject({ status: 'complete', progress: { done: 1, total: 1 } });

    await projectData.applySceneBeatsOperations({
      homeDir,
      document: {
        sceneId: scene.id,
        baseRevisionId: initial.revision.id,
        activate: true,
        operations: [{ operation: 'beats.delete', beatIds: [revision.sceneBeats!.beats[0]!.id] }],
      },
    });
    expect(await readStage()).toMatchObject({ status: 'notStarted', progress: { done: 0, total: 1 } });

    await projectData.setActiveSceneBeatsRevision({ homeDir, sceneId: scene.id, revisionId: initial.revision.id });
    expect(await readStage()).toMatchObject({ status: 'complete', progress: { done: 1, total: 1 } });
  });

  it.each([false, true])('excludes retained plans from deleted Scenes from video progress (old plan has video: %s)', async (oldPlanHasVideo) => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    const input = { homeDir, projectName: 'constantinople' };
    const screenplay = await projectData.readScreenplayStructure(input);
    const oldSceneId = screenplay.screenplay.scenes[0]!.id;
    const added = await projectData.applyScreenplayOperations({
      ...input,
      operations: [{
        operation: 'scene.add',
        scene: { key: 'current', heading: 'EXT. HARBOR - DAY', blocks: [] },
        structureEntryKey: 'current-entry',
        placement: { at: 'end' },
      }],
    });
    const currentSceneId = added.generatedIdentities.find((identity) => identity.key === 'current')!.id;
    const plans = [];
    for (const sceneId of [oldSceneId, currentSceneId]) {
      const plan = await projectData.createShotPlan({
        ...input,
        type: 'shot-list',
        sceneId,
        title: 'Coverage',
        coverage: null,
        shots: [],
      });
      plans.push(plan.shotPlan);
      if (sceneId === oldSceneId && !oldPlanHasVideo) {
        continue;
      }
      const sourcePath = `tmp/${plan.shotPlan.id}.mp4` as ProjectRelativePath;
      await fs.mkdir(path.join(created!.projectPath, 'tmp'), { recursive: true });
      await fs.writeFile(path.join(created!.projectPath, sourcePath), 'video');
      await projectData.attachGenerationMedia({
        homeDir,
        purpose: 'shot-plan.video-generation',
        target: { kind: 'shotPlan', id: plan.shotPlan.id },
        sourceProjectRelativePath: sourcePath,
        generationProvenance: {
          provider: 'test-provider',
          model: 'test-video',
          mediaKind: 'video',
          prompt: 'Harbor coverage.',
          request: { prompt: 'Harbor coverage.' },
        },
      });
    }
    const readStage = async () => (await projectData.readProductionPathResource(input))
      .stages.find((stage) => stage.id === 'videoTakes');
    expect((await readStage())?.progress).toEqual({ done: oldPlanHasVideo ? 2 : 1, total: 2 });

    await projectData.applyScreenplayOperations({
      ...input,
      operations: [{ operation: 'scene.delete', scene: { id: oldSceneId } }],
    });
    expect(await readStage()).toMatchObject({ status: 'complete', progress: { done: 1, total: 1 } });
    const session = openProjectStore({ projectFolder: created!.projectPath, create: false });
    try {
      expect(readShotPlanRecord(session, plans[0]!.id)).toMatchObject({ sceneId: oldSceneId, discardedAt: null });
    } finally {
      session.close();
    }
  });
});
