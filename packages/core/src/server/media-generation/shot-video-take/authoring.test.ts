import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

describe('Shot Video Take authoring documents', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('validates and applies current take authoring documents through core', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;

    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId,
      selectedShotId: 'shot_001',
    });

    expect(context.kind).toBe('sceneShotVideoTakeAuthoringContext');
    expect(context.document).toMatchObject({
      kind: 'sceneShotVideoTakeAuthoring',
      takeId,
      sceneId: ids.sceneId,
      sourceShotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });
    expect(context.context.target).toMatchObject({
      takeId,
      shotIds: ['shot_001', 'shot_002'],
    });
    expect(context.productionPlan.plan.request).toMatchObject({
      sceneId: ids.sceneId,
      takeId,
    });
    expect(typeof context.providerPreview.available).toBe('boolean');

    const document = {
      ...context.document,
      shotIds: ['shot_001'],
    };
    const validation = await projectData.validateSceneShotVideoTakeAuthoringDocument({
      homeDir,
      document,
    });
    expect(validation).toMatchObject({
      valid: true,
      document: {
        takeId,
        shotIds: ['shot_001'],
      },
    });

    const applied = await projectData.applySceneShotVideoTakeAuthoringDocument({
      homeDir,
      document,
    });
    expect(applied).toMatchObject({
      valid: true,
      document: {
        takeId,
        shotIds: ['shot_001'],
      },
      resourceKeys: expect.arrayContaining([
        `scene:${ids.sceneId}`,
        `surface:scene:${ids.sceneId}:takes`,
        `scene-shot-video-take:${takeId}`,
      ]),
    });

    const reread = await projectData.readSceneShotVideoTake({ homeDir, takeId });
    expect(reread.shotIds).toEqual(['shot_001']);
  });

  it('rejects stale authoring documents instead of overwriting newer take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId,
    });

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        customPromptNote: 'Newer production note.',
      },
    });

    await expect(
      projectData.applySceneShotVideoTakeAuthoringDocument({
        homeDir,
        document: {
          ...context.document,
          shotIds: ['shot_001'],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_DOCUMENT',
    });

    const reread = await projectData.readSceneShotVideoTake({ homeDir, takeId });
    expect(reread.shotIds).toEqual(['shot_001', 'shot_002']);
  });
});
