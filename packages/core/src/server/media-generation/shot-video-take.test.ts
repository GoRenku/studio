import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('shot video take preflight and validation', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-shot-video-take-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('reports every requested input slot as a missing required dependency', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'character-sheet',
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
          {
            kind: 'location-sheet',
            subjectKind: 'location',
            subjectId: ids.locationId,
          },
          {
            kind: 'lookbook-sheet',
            subjectKind: 'lookbook',
            subjectId: 'lookbook_test',
          },
        ],
      },
    });

    expect(preflight.valid).toBe(false);
    expect(preflight.inputsToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputInputKind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
          mediaKind: 'image',
        }),
        expect.objectContaining({
          outputInputKind: 'location-sheet',
          subjectKind: 'location',
          subjectId: ids.locationId,
          mediaKind: 'image',
        }),
        expect.objectContaining({
          outputInputKind: 'lookbook-sheet',
          subjectKind: 'lookbook',
          subjectId: 'lookbook_test',
          mediaKind: 'image',
        }),
      ])
    );
    expect(preflight.finalTake.canCreateSpec).toBe(false);
  });

  it('rejects a multi-shot final spec without the required storyboard sheet', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 2);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'reference',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One continuous two-shot video take.',
          parameterValues: {},
          inputs: [],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA384',
      message: expect.stringContaining('multi-shot-storyboard-sheet'),
    });
  });

  it('preserves imported input file paths in preflight prepared inputs', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/first-frame.png';
    await writeProjectFile(sourceProjectRelativePath, 'first frame');

    await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      sourceProjectRelativePath,
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });

    expect(preflight.preparedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'first-frame',
          projectRelativePath: sourceProjectRelativePath,
        }),
      ])
    );
  });

  it('estimates a first-frame take when saved duration is numeric but provider expects a string enum', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.setActiveLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.lookbook.id,
    });

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
        },
      },
    });

    expect(estimate.plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'first-frame',
          pricing: { state: 'priced', estimatedUsd: 0.005 },
        }),
        expect.objectContaining({
          kind: 'final-video-generation',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
    expect(estimate.plan?.request.routeSettings.duration).toBe('9');
    expect(estimate.issues).toEqual([]);
  });

  it('drops stale settings that are unsupported by the selected route before estimating', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        parameterValues: {
          duration: 5,
          aspect_ratio: '16:9',
        },
      },
    });

    expect(estimate.plan?.request.routeSettings).not.toHaveProperty('aspect_ratio');
    expect(estimate.plan?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_PLAN_STALE_SETTING_DROPPED',
          severity: 'warning',
        }),
      ])
    );
    expect(estimate.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA385',
        }),
      ])
    );
  });

  it('includes planned dependency costs in the plan total', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
        },
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          dependencyDrafts: [
            {
              purpose: 'shot.first-frame',
              dependencyKind: 'first-frame',
              outputInputKind: 'first-frame',
              modelChoice: 'fal-ai/openai/gpt-image-2',
              prompt: 'First frame for the map-table shot.',
              parameterValues: {
                image_size: { width: 1024, height: 768 },
                quality: 'low',
              },
            },
          ],
        },
      },
    });

    const plan = estimate.plan;
    expect(plan).toBeTruthy();
    expect(plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency-generation',
          purpose: 'shot.first-frame',
        }),
        expect.objectContaining({
          kind: 'final-video-generation',
          purpose: 'shot.video-take',
        }),
      ])
    );
    expect(plan?.estimate.estimatedTotalUsd).toBeGreaterThan(
      estimate.estimate?.estimatedCostUsd ?? 0
    );
  });

  it('persists and clears one-shot rail groups without deleting single-shot settings', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 2);
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
    const ids = await sampleIds();
    const written = await writeShotList(ids, 3);
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
    const ids = await sampleIds();
    const written = await writeShotList(ids, 5);
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
    const ids = await sampleIds();
    const written = await writeShotList(ids, 4);
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

  it('resolves prepared cast sheet inputs without a shot video take input row', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const sheetSource = 'generated/media/cast-sheet.png';
    await writeProjectFile(sheetSource, 'cast sheet');
    const characterSheet = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: sheetSource,
    });
    const primaryFile = characterSheet.imported.files[0]!;

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'character-sheet',
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
        ],
        preparedInputs: [
          {
            kind: 'character-sheet',
            assetId: characterSheet.imported.assetId,
            assetFileId: primaryFile.id,
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
        ],
      },
    });

    expect(preflight.inputsToCreate).toEqual([]);
    expect(preflight.preparedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
          projectRelativePath: primaryFile.projectRelativePath,
        }),
      ])
    );
  });

  it('reports an active Lookbook reference as needed when no reference image exists', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.setActiveLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.lookbook.id,
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    expect(preflight.inputPlanItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyNodeId: `planned:lookbook-sheet:lookbook:${lookbook.lookbook.id}`,
          title: 'Imperial Wound',
          caption: 'Lookbook sheet',
          mediaKind: 'image',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
  });

  it('uses the selected lookbook sheet as the concrete ready reference input', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.setActiveLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.lookbook.id,
    });
    await writeProjectFile('generated/media/lookbook-sheet-a.png', 'sheet a');
    await writeProjectFile('generated/media/lookbook-sheet-b.png', 'sheet b');
    const sheetA = await projectData.importLookbookSheetMedia({
      homeDir,
      lookbookId: lookbook.lookbook.id,
      sourceProjectRelativePath: 'generated/media/lookbook-sheet-a.png',
      title: 'Sheet A',
    });
    const sheetB = await projectData.importLookbookSheetMedia({
      homeDir,
      lookbookId: lookbook.lookbook.id,
      sourceProjectRelativePath: 'generated/media/lookbook-sheet-b.png',
      title: 'Sheet B',
    });

    await projectData.updateSceneShotLookbookReference({
      projectName: 'constantinople',
      homeDir,
      sceneId: ids.sceneId,
      shotId: 'shot_001',
      lookbookSheetId: sheetB.imported.id,
    });

    const production = {
      inputModeId: 'reference' as const,
      modelChoice: 'fal-ai/bytedance/seedance-2.0' as const,
      parameterValues: { duration: 6 },
    };
    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production,
    });
    const selectedSheetFile = sheetB.imported.asset.files[0]!;
    expect(preflight.preparedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'lookbook-sheet',
          assetId: sheetB.imported.asset.assetId,
          assetFileId: selectedSheetFile.id,
          subjectKind: 'lookbook',
          subjectId: lookbook.lookbook.id,
        }),
      ])
    );
    expect(preflight.preparedInputs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'lookbook-sheet',
          assetId: sheetA.imported.asset.assetId,
        }),
      ])
    );
    expect(preflight.plan?.dependencyMap.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `asset:lookbook-sheet:lookbook:${lookbook.lookbook.id}`,
          kind: 'existing-asset',
          dependencyKind: 'lookbook-sheet',
          assetId: sheetB.imported.asset.assetId,
          assetFileId: selectedSheetFile.id,
        }),
      ])
    );

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production,
    });
    const sheetAChoice = report.lookbookReferences.find(
      (choice) => choice.lookbookSheetId === sheetA.imported.id
    );
    const sheetBChoice = report.lookbookReferences.find(
      (choice) => choice.lookbookSheetId === sheetB.imported.id
    );

    expect(sheetAChoice).toMatchObject({
      selected: false,
      image: {
        state: 'available',
      },
    });
    expect(sheetAChoice?.image.dependencyNodeId).toBeUndefined();
    expect(sheetAChoice?.image.planLineId).toBeUndefined();
    expect(sheetBChoice).toMatchObject({
      selected: true,
      image: {
        state: 'selected-ready',
        dependencyNodeId: `asset:lookbook-sheet:lookbook:${lookbook.lookbook.id}`,
      },
    });
  });

  it('validates selected input ownership before mutating another group selection', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 2);
    await writeProjectFile('generated/media/group-two-a.png', 'first frame a');
    await writeProjectFile('generated/media/group-two-b.png', 'first frame b');
    const selected = await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      sourceProjectRelativePath: 'generated/media/group-two-a.png',
      selection: 'select',
    });
    const unselected = await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      sourceProjectRelativePath: 'generated/media/group-two-b.png',
      selection: 'take',
    });

    await expect(
      projectData.selectShotVideoTakeInput({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        shotIds: ['shot_001'],
        inputId: unselected.input.inputId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA362' });

    const groupTwoInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
    });
    expect(groupTwoInputs.inputs.find((input) => input.inputId === selected.input.inputId))
      .toMatchObject({ selected: true });
    expect(groupTwoInputs.inputs.find((input) => input.inputId === unselected.input.inputId))
      .toMatchObject({ selected: false });
  });

  async function sampleIds() {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    return {
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
    };
  }

  async function writeShotList(
    ids: { sceneId: string; castMemberId: string; locationId: string },
    shotCount: number
  ) {
    return projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, shotCount),
      idGenerator: createDeterministicIdGenerator(),
    });
  }

  async function writeProjectFile(
    projectRelativePath: string,
    contents: string
  ): Promise<void> {
    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const absolutePath = path.join(project.projectFolder, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }
});

function sampleShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string },
  shotCount: number
): SceneShotListDocument {
  const baseShot = {
    title: 'Map study',
    storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
    narrativePurpose: 'Establish the strategic obsession driving the scene.',
    description: 'Wide static shot of Mehmed at the table with the map visible.',
    shotType: 'wide',
    cameraAngle: 'eye level',
    cameraMovement: 'static',
    framing: 'centered table composition',
    lensIntent: 'moderate wide lens feel',
    subject: 'Mehmed and the city map',
    action: 'Mehmed studies the map in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
    audioNotes: 'Quiet room tone and paper movement.',
    productionNotes: 'Keep warm lamplight restrained.',
  };
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy:
      'Hold the map table and Mehmed in one composed frame to emphasize planning.',
    lookbookInfluence: 'Use the project aspect ratio unless a shot specifies otherwise.',
    shots: Array.from({ length: shotCount }, (_, index) => ({
      ...baseShot,
      shotId: `shot_${String(index + 1).padStart(3, '0')}`,
      title: index === 0 ? baseShot.title : `Map study alternate ${index + 1}`,
    })),
  };
}

function lookbookDocument() {
  return {
    kind: 'lookbook' as const,
    lookbook: {
      thesis: {
        statement: 'The movie should feel rigorous and tense.',
        principles: ['Use negative space as pressure.'],
      },
      palette: {
        description: 'Stone, smoke, and muted gold.',
        colors: [
          {
            hex: '#8a6f2a',
            name: 'Wounded gold',
            meaning: 'Ceremony under pressure.',
          },
        ],
        observations: [{ text: 'Warmth appears only where authority is strained.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'The image language stays austere and watchful.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [
          {
            name: 'Map pressure',
            description: 'Maps and walls compress the frame.',
          },
        ],
      },
      lighting: {
        description: 'Practical pools of warm light cut through cool rooms.',
        patterns: [
          {
            name: 'Lamp islands',
            description: 'Oil lamps isolate decision makers.',
          },
        ],
      },
      texture: {
        description: 'Stone, vellum, smoke, and worn metal carry texture.',
        observations: [{ text: 'Fine surface texture is visible in midtones.' }],
      },
      camera: {
        description: 'Camera grammar is patient and observant.',
        movement: [
          { name: 'Slow push', description: 'Push in only when a decision hardens.' },
        ],
        motion: [
          { name: 'Held labor', description: 'Blocking moves with deliberate weight.' },
        ],
        framing: [
          { name: 'Measured distance', description: 'Close-ups are rare and earned.' },
        ],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
