import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AssetTarget,
  CastProfileGenerationSpec,
  LookbookSheetGenerationSpec,
  SceneShotListDocument,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakePreparedInput,
} from '../../src/client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../src/server/index.js';
import { updateAssetRelationshipSelection } from '../../src/server/database/access/asset-relationships/index.js';
import { deleteAssetFileRecordsForAsset } from '../../src/server/database/access/asset-files.js';
import { openProjectSession } from '../../src/server/database/lifecycle/active-session.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../src/server/testing/project-data-fixtures.js';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

describe('media generation dependency inventory estimates integration', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-generation-dependency-inventory-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('estimates a draft Lookbook sheet dependency spec through the shared purpose registry without persisting it', async () => {
    const lookbook = await createActiveLookbook(projectData, homeDir);

    const estimate = await projectData.estimateDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: lookbookSheetSpec(lookbook.lookbook.id),
    });

    expect(estimate.spec.id).toBe(`draft:lookbook.sheet:lookbook:${lookbook.lookbook.id}`);
    expect(estimate.estimate.estimatedCostUsd).toEqual(expect.any(Number));

    const persisted = await projectData.listMediaGenerationSpecs({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.sheet',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });
    expect(persisted.specs).toEqual([]);
  });

  it('prices shot reference video plus cast, location, and Lookbook dependency lines from the inventory', async () => {
    const ids = await sampleIds(projectData, homeDir);
    const lookbook = await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
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
        agentProposal: {
          basedOnInputModeId: 'reference',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          basedOnShotIds: ['shot_001'],
          dependencyDrafts: [],
          finalPromptDraft: {
            prompt:
              'Generate the final reference-guided video take of Mehmed studying the map in restrained lamplight.',
            title: 'Map study video take',
          },
        },
      },
    });

    expect('estimateLines' in preflight).toBe(false);
    expect(preflight.plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'cast-character-sheet',
          purpose: 'cast.character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'location-environment-sheet',
          purpose: 'location.environment-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'lookbook-sheet',
          purpose: 'lookbook.sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'final-video-generation',
          purpose: 'shot.video-take',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );

    const pricedTotal = preflight.plan!.lines.reduce((sum, line) => {
      return line.pricing.state === 'priced' ? sum + line.pricing.estimatedUsd : sum;
    }, 0);
    expect(preflight.plan!.estimate).toMatchObject({
      state: 'complete',
      estimatedTotalUsd: pricedTotal,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(preflight.inputPlanItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId: `dependency:cast-character-sheet:${ids.castMemberId}`,
          title: 'Mehmed II',
          caption: 'Character sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyLineId: `dependency:location-environment-sheet:${ids.locationId}`,
          title: "Mehmed's council chamber",
          caption: 'Location sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyLineId: `dependency:lookbook-sheet:${lookbook.lookbook.id}`,
          title: 'Imperial Wound',
          caption: 'Lookbook sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
  });

  it('expands a planned first-frame input into cast, location, and Lookbook dependency lines', async () => {
    const ids = await sampleIds(projectData, homeDir);
    const lookbook = await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 12,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          basedOnShotIds: ['shot_001'],
          dependencyDrafts: [
            {
              purpose: 'shot.first-frame',
              dependencyKind: 'first-frame',
              outputInputKind: 'first-frame',
              prompt:
                'Author the exact first frame: Mehmed at the map table in a wide, eye-level, centered composition with restrained warm lamplight and the selected cast, location, and lookbook continuity.',
              title: 'Map study first frame',
            },
          ],
          finalPromptDraft: {
            prompt:
              'Generate the shot video take beginning from the authored map-study first frame, holding a restrained strategic mood and a quiet room tone.',
            title: 'Map study first-frame take',
          },
        },
      },
    });

    const firstFrameLineId = 'dependency:first-frame:production-group:';
    const characterLineId = `dependency:cast-character-sheet:${ids.castMemberId}`;
    const locationLineId = `dependency:location-environment-sheet:${ids.locationId}`;
    const lookbookLineId = `dependency:lookbook-sheet:${lookbook.lookbook.id}`;

    expect(preflight.plan?.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: characterLineId,
          requiredBy: expect.arrayContaining([firstFrameLineId]),
          required: false,
        }),
        expect.objectContaining({
          id: locationLineId,
          requiredBy: expect.arrayContaining([firstFrameLineId]),
          required: false,
        }),
        expect.objectContaining({
          id: lookbookLineId,
          requiredBy: expect.arrayContaining([firstFrameLineId]),
          required: false,
        }),
        expect.objectContaining({
          id: firstFrameLineId,
          requiredBy: expect.arrayContaining(['root:shot.video-take']),
          required: true,
        }),
      ])
    );
    expect(preflight.plan).not.toHaveProperty('dependencyMap');
    expect(preflight.inputPlanItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId: characterLineId,
          title: 'Mehmed II',
          caption: 'Character sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.04 }),
        }),
        expect.objectContaining({
          dependencyLineId: locationLineId,
          title: "Mehmed's council chamber",
          caption: 'Location sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.037 }),
        }),
        expect.objectContaining({
          dependencyLineId: lookbookLineId,
          title: 'Imperial Wound',
          caption: 'Lookbook sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.04 }),
        }),
        expect.objectContaining({
          dependencyLineId: firstFrameLineId,
          title: 'First frame',
          caption: 'First frame',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.005 }),
        }),
      ])
    );
    expect(preflight.inputPlanItems).toHaveLength(4);
    expect(preflight.plan?.estimate).toMatchObject({
      state: 'complete',
      pricedLineCount: 5,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(preflight.plan?.estimate.estimatedTotalUsd).toBeCloseTo(4.658, 6);
  });

  it('blocks generated shot dependencies when the agent has not authored a dependency draft', async () => {
    const ids = await sampleIds(projectData, homeDir);
    const lookbook = await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 12,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          basedOnShotIds: ['shot_001'],
          dependencyDrafts: [],
          finalPromptDraft: {
            prompt:
              'Generate the shot video take only after all authored image dependencies are prepared.',
            title: 'Blocked first-frame take',
          },
        },
      },
    });

    const firstFrameLine = preflight.plan!.dependencyInventory.dependencies.find(
      (line) => line.id === 'dependency:first-frame:production-group:'
    );
    const characterLineId = `dependency:cast-character-sheet:${ids.castMemberId}`;
    const locationLineId = `dependency:location-environment-sheet:${ids.locationId}`;
    const lookbookLineId = `dependency:lookbook-sheet:${lookbook.lookbook.id}`;

    expect(firstFrameLine).toMatchObject({
      availability: { state: 'missing-generated' },
      generationDraft: {
        state: 'estimate-only',
        reason: 'Author a concrete dependency draft before generating this shot input.',
      },
      purpose: 'shot.first-frame',
      pricing: { state: 'priced', estimatedUsd: 0.005 },
      diagnostics: [],
    });
    expect(firstFrameLine?.generationDraft).not.toHaveProperty('draftGenerationSpec');
    expect(preflight.plan?.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: characterLineId }),
        expect.objectContaining({ id: locationLineId }),
        expect.objectContaining({ id: lookbookLineId }),
      ])
    );
    expect(preflight.finalTake.canCreateSpec).toBe(false);
    expect(preflight.plan?.estimate).toMatchObject({
      state: 'complete',
      pricedLineCount: 5,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(preflight.plan?.estimate.estimatedTotalUsd).toBeCloseTo(4.658, 6);
  });

  it('prices first and last frame dependencies before their prompts are authored', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        inputModeId: 'first-last-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
      },
    });

    const firstFrameLine = estimate.plan!.dependencyInventory.dependencies.find(
      (line) => line.id === 'dependency:first-frame:production-group:'
    );
    const lastFrameLine = estimate.plan!.dependencyInventory.dependencies.find(
      (line) => line.id === 'dependency:last-frame:production-group:'
    );

    expect(firstFrameLine).toMatchObject({
      availability: { state: 'missing-generated' },
      generationDraft: { state: 'estimate-only' },
      pricing: { state: 'priced', estimatedUsd: 0.005 },
    });
    expect(firstFrameLine?.generationDraft).not.toHaveProperty('draftGenerationSpec');
    expect(lastFrameLine).toMatchObject({
      availability: { state: 'missing-generated' },
      generationDraft: { state: 'estimate-only' },
      pricing: { state: 'priced', estimatedUsd: 0.005 },
    });
    expect(lastFrameLine?.generationDraft).not.toHaveProperty('draftGenerationSpec');
    expect(estimate.plan?.estimate).toMatchObject({
      state: 'complete',
      pricedLineCount: 6,
      unpricedLineCount: 0,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(estimate.plan?.estimate.estimatedTotalUsd).toBeCloseTo(3.529, 6);
  });

  it('plans a valid shot.video-take spec with imported first and last frame inputs through the shared dependency planner', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/generic-first-frame.png',
      'first frame'
    );
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/generic-last-frame.png',
      'last frame'
    );
    const firstFrame = await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      sourceProjectRelativePath: 'generated/media/generic-first-frame.png',
    });
    const lastFrame = await projectData.importShotLastFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      sourceProjectRelativePath: 'generated/media/generic-last-frame.png',
    });
    const spec: ShotVideoTakeGenerationSpec = {
      purpose: 'shot.video-take',
      target: {
        kind: 'sceneShotGroup',
        id: 'scene_shot_video_take_group_generic',
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        productionGroupId: 'scene_shot_video_take_group_generic',
        shotIds: ['shot_001'],
      },
      inputModeId: 'first-last-frame',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      prompt:
        'Generate the final take from the imported first and last frame anchors.',
      parameterValues: {
        duration: '9',
        aspect_ratio: '16:9',
        resolution: '720p',
        generate_audio: true,
      },
      inputs: [
        generationInputFromAvailable(firstFrame.input),
        generationInputFromAvailable(lastFrame.input),
      ],
      title: 'Generic planner first-last-frame take',
    };

    const plan = await projectData.planMediaGenerationDependencies({
      projectName: 'constantinople',
      homeDir,
      spec,
    });

    expect(plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dependency:first-frame:production-group:scene_shot_video_take_group_generic',
          dependencyKind: 'first-frame',
          availability: { state: 'satisfied' },
          selectedAsset: expect.objectContaining({
            assetId: firstFrame.input.assetId,
            assetFileId: firstFrame.input.assetFileId,
          }),
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
        expect.objectContaining({
          id: 'dependency:last-frame:production-group:scene_shot_video_take_group_generic',
          dependencyKind: 'last-frame',
          availability: { state: 'satisfied' },
          selectedAsset: expect.objectContaining({
            assetId: lastFrame.input.assetId,
            assetFileId: lastFrame.input.assetFileId,
          }),
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
      ])
    );
    expect(plan.lines.filter((line) => line.kind === 'dependency-generation')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyKind: 'cast-character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyKind: 'location-environment-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyKind: 'lookbook-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
    expect(plan.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId:
            'dependency:first-frame:production-group:scene_shot_video_take_group_generic',
          kind: 'reused-asset',
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
        expect.objectContaining({
          dependencyLineId:
            'dependency:last-frame:production-group:scene_shot_video_take_group_generic',
          kind: 'reused-asset',
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
        expect.objectContaining({
          dependencyLineId: 'root:shot.video-take',
          kind: 'final-video-generation',
          pricing: { state: 'priced', estimatedUsd: 3.402 },
        }),
      ])
    );
    expect(plan.estimate).toMatchObject({
      state: 'complete',
      estimatedTotalUsd: expect.any(Number),
      pricedDependencyCount: 6,
      unavailableDependencyCount: 0,
      requiresPriceOverride: false,
    });
    expect(plan.dependencyInventory.rootGeneration.canCreateSpec).toBe(true);
  });

  it('reuses imported first and last frame shot inputs at zero cost in the shot production estimate', async () => {
    const ids = await sampleIds(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/reused-first-frame.png',
      'first frame'
    );
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/reused-last-frame.png',
      'last frame'
    );
    const firstFrame = await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      sourceProjectRelativePath: 'generated/media/reused-first-frame.png',
    });
    const lastFrame = await projectData.importShotLastFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      productionGroupId: firstFrame.target.productionGroupId,
      sourceProjectRelativePath: 'generated/media/reused-last-frame.png',
    });

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      productionGroupId: firstFrame.target.productionGroupId,
      production: {
        inputModeId: 'first-last-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        preparedInputs: [
          preparedInputFromAvailable(firstFrame.input),
          preparedInputFromAvailable(lastFrame.input),
        ],
        parameterValues: {
          duration: 9,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
      },
    });

    expect(estimate.issues).toEqual([]);
    expect(estimate.plan?.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dependency:first-frame:production-group:',
          availability: { state: 'satisfied' },
          selectedAsset: expect.objectContaining({
            assetId: firstFrame.input.assetId,
            assetFileId: firstFrame.input.assetFileId,
          }),
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
        expect.objectContaining({
          id: 'dependency:last-frame:production-group:',
          availability: { state: 'satisfied' },
          selectedAsset: expect.objectContaining({
            assetId: lastFrame.input.assetId,
            assetFileId: lastFrame.input.assetFileId,
          }),
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
      ])
    );
    expect(
      estimate.plan?.lines.filter((line) => line.kind === 'dependency-generation')
    ).toEqual([]);
    expect(estimate.plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId: 'dependency:first-frame:production-group:',
          kind: 'reused-asset',
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
        expect.objectContaining({
          dependencyLineId: 'dependency:last-frame:production-group:',
          kind: 'reused-asset',
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
        expect.objectContaining({
          dependencyLineId: 'root:shot.video-take',
          kind: 'final-video-generation',
          pricing: { state: 'priced', estimatedUsd: 3.402 },
        }),
      ])
    );
    expect(estimate.plan?.estimate).toMatchObject({
      state: 'complete',
      estimatedTotalUsd: 3.402,
      pricedLineCount: 3,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
  });

  it('uses the shared dependency inventory to price cast profile character-sheet dependencies', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);

    const plan = await projectData.planMediaGenerationDependencies({
      projectName: 'constantinople',
      homeDir,
      spec: castProfileSpec(ids.castMemberId),
    });

    const characterLineId = `dependency:cast-character-sheet:${ids.castMemberId}`;
    expect(plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: characterLineId,
          requiredBy: expect.arrayContaining(['root:cast.profile']),
          availability: { state: 'missing-generated' },
        }),
      ])
    );
    expect(plan.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId: characterLineId,
          kind: 'dependency-generation',
          dependencyKind: 'cast-character-sheet',
          purpose: 'cast.character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyLineId: 'root:cast.profile',
          kind: 'final-generation',
          purpose: 'cast.profile',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );

    const pricedTotal = plan.lines.reduce((sum, line) => {
      return line.pricing.state === 'priced' ? sum + line.pricing.estimatedUsd : sum;
    }, 0);
    expect(plan.estimate).toMatchObject({
      state: 'complete',
      estimatedTotalUsd: pricedTotal,
      unavailableDependencyCount: 0,
      requiresPriceOverride: false,
    });
  });

  it('blocks cast profile spec creation until character-sheet dependencies are imported assets', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);

    await expect(
      projectData.createMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir,
        spec: castProfileSpec(ids.castMemberId),
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_UNRESOLVED_REQUIRED_DEPENDENCIES',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_UNRESOLVED_REQUIRED_DEPENDENCY',
        }),
      ]),
    });
  });

  it('reuses an imported character sheet at zero cost before creating a cast profile spec', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/cast-profile-source-sheet.png',
      'character sheet'
    );
    const imported = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/cast-profile-source-sheet.png',
    });
    const primaryFile = imported.imported.files[0]!;

    const plan = await projectData.planMediaGenerationDependencies({
      projectName: 'constantinople',
      homeDir,
      spec: castProfileSpec(ids.castMemberId),
    });

    expect(plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${ids.castMemberId}`,
          availability: { state: 'satisfied' },
          selectedAsset: expect.objectContaining({
            assetId: imported.imported.assetId,
            assetFileId: primaryFile.id,
          }),
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
      ])
    );
    const created = await projectData.createMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: castProfileSpec(ids.castMemberId),
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(created).toMatchObject({
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: ids.castMemberId },
    });
  });

  it('reports ambiguous selected character sheets as structured selector diagnostics', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/ambiguous-character-sheet-a.png',
      'character sheet a'
    );
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/ambiguous-character-sheet-b.png',
      'character sheet b'
    );
    const first = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/ambiguous-character-sheet-a.png',
    });
    const second = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/ambiguous-character-sheet-b.png',
    });
    await markAssetSelected({
      homeDir,
      target: { kind: 'castMember', castMemberId: ids.castMemberId },
      assetId: first.imported.assetId,
      selectionOrder: 1,
    });
    await markAssetSelected({
      homeDir,
      target: { kind: 'castMember', castMemberId: ids.castMemberId },
      assetId: second.imported.assetId,
      selectionOrder: 2,
    });

    const plan = await projectData.planMediaGenerationDependencies({
      projectName: 'constantinople',
      homeDir,
      spec: castProfileSpec(ids.castMemberId),
    });

    const lineId = `dependency:cast-character-sheet:${ids.castMemberId}`;
    expect(plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: lineId,
          availability: { state: 'invalid-selection' },
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: 'CORE_MEDIA_DEPENDENCY_AMBIGUOUS_SELECTED_ASSET',
              severity: 'error',
            }),
          ]),
        }),
      ])
    );
    expect(plan.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId: lineId,
          kind: 'required-attachment',
          pricing: { state: 'not-applicable', estimatedUsd: null },
        }),
      ])
    );
    expect(plan.estimate).toMatchObject({
      state: 'unavailable',
      estimatedTotalUsd: null,
      unavailableDependencyCount: 1,
    });
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_AMBIGUOUS_SELECTED_ASSET',
        }),
      ])
    );
  });

  it('reports selected character sheets with missing image files as structured selector diagnostics', async () => {
    const ids = await sampleIds(projectData, homeDir);
    await createActiveLookbook(projectData, homeDir);
    await writeProjectFile(
      projectData,
      homeDir,
      'generated/media/missing-file-character-sheet.png',
      'character sheet'
    );
    const imported = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/missing-file-character-sheet.png',
    });
    await markAssetSelected({
      homeDir,
      target: { kind: 'castMember', castMemberId: ids.castMemberId },
      assetId: imported.imported.assetId,
      selectionOrder: 1,
    });
    await removeAssetFiles({
      homeDir,
      assetId: imported.imported.assetId,
    });

    const plan = await projectData.planMediaGenerationDependencies({
      projectName: 'constantinople',
      homeDir,
      spec: castProfileSpec(ids.castMemberId),
    });

    const lineId = `dependency:cast-character-sheet:${ids.castMemberId}`;
    expect(plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: lineId,
          availability: { state: 'invalid-selection' },
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              code: 'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
              severity: 'error',
            }),
          ]),
        }),
      ])
    );
    expect(plan.estimate).toMatchObject({
      state: 'unavailable',
      estimatedTotalUsd: null,
      unavailableDependencyCount: 1,
    });
    expect(plan.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
        }),
      ])
    );
  });
});

async function markAssetSelected(input: {
  homeDir: string;
  target: AssetTarget;
  assetId: string;
  selectionOrder: number;
}): Promise<void> {
  const { session } = await openProjectSession({
    projectName: 'constantinople',
    homeDir: input.homeDir,
  });
  updateAssetRelationshipSelection(session, {
    target: input.target,
    assetId: input.assetId,
    selection: 'select',
    selectionOrder: input.selectionOrder,
    updatedAt: new Date().toISOString(),
  });
}

async function removeAssetFiles(input: {
  homeDir: string;
  assetId: string;
}): Promise<void> {
  const { session } = await openProjectSession({
    projectName: 'constantinople',
    homeDir: input.homeDir,
  });
  deleteAssetFileRecordsForAsset(session, input.assetId);
}

async function sampleIds(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
) {
  const screenplay = await projectData.readScreenplay({ homeDir });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return {
    sceneId: scene.id as string,
    castMemberId: screenplay.screenplay!.cast[1]!.id as string,
    locationId: screenplay.screenplay!.locations[0]!.id as string,
  };
}

function lookbookSheetSpec(lookbookId: string): LookbookSheetGenerationSpec {
  return {
    purpose: 'lookbook.sheet',
    target: { kind: 'lookbook', id: lookbookId },
    modelChoice: 'fal-ai/openai/gpt-image-2',
    prompt: 'Architectural wound reference sheet.',
    takeCount: 1,
    seed: null,
    sheetFrame: 'project',
    detail: 'standard',
    outputFormat: 'png',
    title: 'Architectural wound reference sheet',
  };
}

function castProfileSpec(castMemberId: string): CastProfileGenerationSpec {
  return {
    purpose: 'cast.profile',
    target: { kind: 'castMember', id: castMemberId },
    modelChoice: 'fal-ai/openai/gpt-image-2',
    prompt: 'Create a restrained cast profile portrait for the production bible.',
    takeCount: 1,
    seed: null,
    imageFrame: '1:1',
    detail: 'standard',
    outputFormat: 'png',
    title: 'Production cast profile',
  };
}

async function createActiveLookbook(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
) {
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
  return lookbook;
}

async function writeProjectFile(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string,
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

function generationInputFromAvailable(
  input: NonNullable<
    Awaited<ReturnType<ProjectDataService['importShotFirstFrame']>>
  >['input']
): ShotVideoTakeGenerationSpec['inputs'][number] {
  return {
    kind: input.kind,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    role: input.kind,
    mediaKind: input.mediaKind,
    projectRelativePath: input.projectRelativePath,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
  };
}

function preparedInputFromAvailable(
  input: NonNullable<
    Awaited<ReturnType<ProjectDataService['importShotFirstFrame']>>
  >['input']
): ShotVideoTakePreparedInput {
  return {
    kind: input.kind,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
  };
}

function sampleShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string }
): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy: 'Hold the map table and Mehmed in one composed frame.',
    lookbookInfluence: 'Use the active Lookbook reference language.',
    shots: [
      {
        shotId: 'shot_001',
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
      },
    ],
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
        colors: [{ hex: '#8a6f2a', name: 'Wounded gold', meaning: 'Ceremony under pressure.' }],
        observations: [{ text: 'Warmth appears only where authority is strained.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'The image language stays austere and watchful.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [{ name: 'Map pressure', description: 'Maps and walls compress the frame.' }],
      },
      lighting: {
        description: 'Practical pools of warm light cut through cool rooms.',
        patterns: [{ name: 'Lamp islands', description: 'Oil lamps isolate decision makers.' }],
      },
      texture: {
        description: 'Stone, vellum, smoke, and worn metal carry texture.',
        observations: [{ text: 'Fine surface texture is visible in midtones.' }],
      },
      camera: {
        description: 'Camera grammar is patient and observant.',
        movement: [{ name: 'Slow push', description: 'Push in only when a decision hardens.' }],
        motion: [{ name: 'Held labor', description: 'Blocking moves with deliberate weight.' }],
        framing: [{ name: 'Measured distance', description: 'Close-ups are rare and earned.' }],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
