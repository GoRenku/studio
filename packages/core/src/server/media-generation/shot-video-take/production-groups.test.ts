import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';
import { createDeterministicIdGenerator } from '../../index.js';

describe('shot video take preflight and validation', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('persists and clears one-shot rail groups without deleting single-shot settings', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await projectData.updateShotVideoTakeProductionGroup({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      productionGroupId: 'group_single',
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        customPromptNote: 'Hold the cannon smoke low.',
      },
    });

    await projectData.updateShotVideoTakeRailGroups({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      railGroups: [{ productionGroupId: 'group_single', shotIds: ['shot_001'] }],
    });
    let read = await projectData.readSceneShotList({
      homeDir,
      shotListId: written.shotList.id,
    });
    expect(read.shotList?.videoTakeRailGroups).toEqual([
      { productionGroupId: 'group_single', shotIds: ['shot_001'] },
    ]);

    await projectData.updateShotVideoTakeRailGroups({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      railGroups: [],
    });
    read = await projectData.readSceneShotList({
      homeDir,
      shotListId: written.shotList.id,
    });
    expect(read.shotList?.videoTakeRailGroups).toEqual([]);
    expect(read.shotList?.videoTakeProductionGroups).toContainEqual(
      expect.objectContaining({
        productionGroupId: 'group_single',
        shotIds: ['shot_001'],
        videoTakeProduction: expect.objectContaining({
          customPromptNote: 'Hold the cannon smoke low.',
        }),
      })
    );
  });

  it('copies group settings on split and marks copied prompts stale for new shot ids', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 3);
    await projectData.updateShotVideoTakeProductionGroup({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      productionGroupId: 'group_original',
      shotIds: ['shot_001', 'shot_002', 'shot_003'],
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 9 },
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
    await projectData.updateShotVideoTakeRailGroups({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      railGroups: [
        {
          productionGroupId: 'group_original',
          shotIds: ['shot_001', 'shot_002', 'shot_003'],
        },
      ],
    });

    await projectData.updateShotVideoTakeRailGroups({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      idGenerator: createDeterministicIdGenerator(),
      railGroups: [
        { productionGroupId: 'group_original', shotIds: ['shot_001'] },
        { sourceProductionGroupId: 'group_original', shotIds: ['shot_003'] },
      ],
    });

    const read = await projectData.readSceneShotList({
      homeDir,
      shotListId: written.shotList.id,
    });
    const splitGroups = read.shotList?.videoTakeProductionGroups ?? [];
    const lower = splitGroups.find((group) =>
      group.shotIds.includes('shot_003')
    );
    const middle = splitGroups.find((group) =>
      group.shotIds.includes('shot_002')
    );
    expect(lower?.videoTakeProduction).toMatchObject({
      inputModeId: 'first-frame',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      parameterValues: { duration: 9 },
      agentProposal: {
        basedOnShotIds: ['shot_001', 'shot_002', 'shot_003'],
        finalPromptDraft: { prompt: 'Original three-shot prompt.' },
      },
    });
    expect(lower?.videoTakeProduction.preparedInputs).toBeUndefined();
    expect(middle?.videoTakeProduction.agentProposal).toMatchObject({
      basedOnShotIds: ['shot_001', 'shot_002', 'shot_003'],
    });

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_003'],
    });
    expect(estimate.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA378' }),
      ])
    );
  });

  it('keeps upper group settings when two rail groups merge', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 5);
    await projectData.updateShotVideoTakeProductionGroup({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      productionGroupId: 'group_upper',
      shotIds: ['shot_001', 'shot_002'],
      production: {
        inputModeId: 'text-only',
        customPromptNote: 'Upper settings win.',
      },
    });
    await projectData.updateShotVideoTakeProductionGroup({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      productionGroupId: 'group_lower',
      shotIds: ['shot_004', 'shot_005'],
      production: {
        inputModeId: 'reference',
        customPromptNote: 'Lower settings should not win.',
      },
    });
    await projectData.updateShotVideoTakeRailGroups({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      railGroups: [
        { productionGroupId: 'group_upper', shotIds: ['shot_001', 'shot_002'] },
        { productionGroupId: 'group_lower', shotIds: ['shot_004', 'shot_005'] },
      ],
    });

    await projectData.updateShotVideoTakeRailGroups({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      railGroups: [
        {
          productionGroupId: 'group_upper',
          mergePartnerProductionGroupId: 'group_lower',
          shotIds: ['shot_001', 'shot_002', 'shot_003', 'shot_004', 'shot_005'],
        },
      ],
    });

    const read = await projectData.readSceneShotList({
      homeDir,
      shotListId: written.shotList.id,
    });
    expect(read.shotList?.videoTakeRailGroups).toEqual([
      {
        productionGroupId: 'group_upper',
        shotIds: ['shot_001', 'shot_002', 'shot_003', 'shot_004', 'shot_005'],
      },
    ]);
    expect(read.shotList?.videoTakeProductionGroups).toEqual([
      expect.objectContaining({
        productionGroupId: 'group_upper',
        shotIds: ['shot_001', 'shot_002', 'shot_003', 'shot_004', 'shot_005'],
        videoTakeProduction: expect.objectContaining({
          inputModeId: 'text-only',
          customPromptNote: 'Upper settings win.',
        }),
      }),
    ]);
  });

  it('rejects overlapping and non-contiguous rail groups with structured core errors', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 4);
    await expect(
      projectData.updateShotVideoTakeRailGroups({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        railGroups: [
          { shotIds: ['shot_001', 'shot_002'] },
          { shotIds: ['shot_002', 'shot_003'] },
        ],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA414' });
    await expect(
      projectData.updateShotVideoTakeRailGroups({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        railGroups: [{ shotIds: ['shot_001', 'shot_003'] }],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA381' });
  });
});
