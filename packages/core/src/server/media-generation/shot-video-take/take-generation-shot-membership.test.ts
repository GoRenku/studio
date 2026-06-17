import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

describe('shot video take generation shot membership', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('keeps prepared production inputs when membership does not change', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeGenerationId = written.takeGeneration.takeGenerationId;

    await projectData.updateSceneShotVideoTakeGenerationProduction({
      homeDir,
      takeGenerationId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        customPromptNote: 'Hold the cannon smoke low.',
        preparedInputs: [
          {
            kind: 'reference-image',
            assetId: 'asset_reference',
            assetFileId: 'asset_file_reference',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
      },
    });

    const context = await projectData.updateSceneShotVideoTakeGenerationShots({
      homeDir,
      takeGenerationId,
      shotIds: ['shot_001'],
    });

    expect(context.takeGeneration.production).toMatchObject({
      inputModeId: 'reference',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      customPromptNote: 'Hold the cannon smoke low.',
      preparedInputs: [
        {
          kind: 'reference-image',
          assetId: 'asset_reference',
          assetFileId: 'asset_file_reference',
          subjectKind: 'shot',
          subjectId: 'shot_001',
        },
      ],
    });
  });

  it('copies settings on split and marks copied prompts stale for new shot ids', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 3);
    const takeGenerationId = written.takeGeneration.takeGenerationId;

    await projectData.updateSceneShotVideoTakeGenerationProduction({
      homeDir,
      takeGenerationId,
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 9 },
        requestedInputs: [
          {
            kind: 'reference-image',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
          {
            kind: 'reference-image',
            subjectKind: 'shot',
            subjectId: 'shot_003',
          },
        ],
        preparedInputs: [
          {
            kind: 'first-frame',
            assetId: 'asset_old',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          dependencyDrafts: [],
          finalPromptDraft: { prompt: 'Original three-shot prompt.' },
        },
      },
    });

    const context = await projectData.updateSceneShotVideoTakeGenerationShots({
      homeDir,
      takeGenerationId,
      shotIds: ['shot_003'],
    });

    expect(context.takeGeneration.shotIds).toEqual(['shot_003']);
    expect(context.takeGeneration.production).toMatchObject({
      inputModeId: 'first-frame',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      parameterValues: { duration: 9 },
      requestedInputs: [
        {
          kind: 'reference-image',
          subjectKind: 'shot',
          subjectId: 'shot_003',
        },
      ],
      agentProposal: {
        basedOnShotIds: ['shot_001', 'shot_002', 'shot_003'],
        finalPromptDraft: { prompt: 'Original three-shot prompt.' },
      },
    });
    expect(context.takeGeneration.production.preparedInputs).toBeUndefined();

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      takeGenerationId,
    });
    expect(estimate.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA378' }),
      ])
    );
  });

  it('keeps open take generation settings when membership expands like a merge', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 5);
    const takeGeneration = await projectData.createSceneShotVideoTakeGeneration({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });

    await projectData.updateSceneShotVideoTakeGenerationProduction({
      homeDir,
      takeGenerationId: takeGeneration.takeGenerationId,
      production: {
        inputModeId: 'text-only',
        customPromptNote: 'Open take generation settings win.',
      },
    });

    const context = await projectData.updateSceneShotVideoTakeGenerationShots({
      homeDir,
      takeGenerationId: takeGeneration.takeGenerationId,
      shotIds: ['shot_001', 'shot_002', 'shot_003', 'shot_004', 'shot_005'],
    });

    expect(context.takeGeneration.production).toMatchObject({
      inputModeId: 'text-only',
      customPromptNote: 'Open take generation settings win.',
    });
  });

  it('rejects duplicate and non-contiguous shot ids with structured core errors', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 4);
    const takeGenerationId = written.takeGeneration.takeGenerationId;

    await expect(
      projectData.updateSceneShotVideoTakeGenerationShots({
        homeDir,
        takeGenerationId,
        shotIds: ['shot_001', 'shot_002', 'shot_002'],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA380' });

    await expect(
      projectData.updateSceneShotVideoTakeGenerationShots({
        homeDir,
        takeGenerationId,
        shotIds: ['shot_001', 'shot_003'],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA381' });
  });
});
