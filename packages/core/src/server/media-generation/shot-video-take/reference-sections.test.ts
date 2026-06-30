import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';
import type {
  ProjectRelativePath,
  SceneShotVideoTake,
  SceneShotVideoTakeReferenceSelections,
} from '../../../client/index.js';
import { createDeterministicIdGenerator } from '../../index.js';
import { sceneDialogueAudioDependencyId } from '../dependency-identifiers.js';
import { buildDialogueAudioCapabilityReport } from './reference-sections.js';
import { groupReferenceInclusionOverride } from './reference-inclusions.js';

describe('shot video take preflight and validation', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('keeps excluded default video prompt sheet references visible for restore', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      },
    });

    const defaultReport = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    const storyboardChoice = defaultReport.references.general.find(
      (choice) => choice.kind === 'video-prompt-sheet'
    );
    expect(storyboardChoice?.card).toMatchObject({
      included: true,
      required: false,
    });

    await projectData.updateSceneShotVideoTakeReferenceInclusion({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      dependencyId: storyboardChoice!.card.dependencyId!,
      inclusion: 'exclude',
    });

    const excludedReport = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });

    expect(excludedReport.references.general).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'video-prompt-sheet',
          selected: false,
          card: expect.objectContaining({
            dependencyId: storyboardChoice!.card.dependencyId,
            included: false,
            required: false,
            inclusionOverride: 'exclude',
          }),
        }),
      ])
    );
  });

  it('rejects unknown reference inclusion dependencies without persisting them', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeReferenceInclusion({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        dependencyId: 'reference-image:shot:shot_missing',
        inclusion: 'exclude',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA432',
    });

    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    expect(takeReferenceSelections(take).dependencyInclusions).toEqual({});
  });

  it('reports an active Lookbook reference as needed when no reference image exists', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    expect(preflight.inputPlanItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyLineId: `dependency:lookbook-sheet:${lookbook.lookbook.id}`,
          title: 'Imperial Wound',
          caption: 'Lookbook sheet',
          mediaKind: 'image',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
  });

  it('shows a planned Location Sheet reference when a selected shot location has no sheets', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    const locationReference = report.references.locations.find(
      (location) => location.locationId === ids.locationId
    );

    expect(locationReference?.environmentSheets).toEqual([
      expect.objectContaining({
        assetId: null,
        title: `${locationReference?.name} Location Sheet`,
        selected: true,
        card: expect.objectContaining({
          state: 'selected-planned',
          dependencyId: `location-environment-sheet:${ids.locationId}`,
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      }),
    ]);
    expect(report.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:location-environment-sheet:${ids.locationId}`,
          availability: { state: 'missing-generated' },
          dependencyKind: 'location-environment-sheet',
        }),
      ])
    );
  });

  it('shows scene cast choices without planning unselected character-sheet dependencies', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const extraCastMemberId = await shotVideoTakeProject.addVisualExtraCastMember();
    await shotVideoTakeProject.addCastToSceneNarrative({
      sceneId: ids.sceneId,
      extraCastMemberId,
      locationId: ids.locationId,
    });
    const shotList = shotVideoTakeProject.sampleShotList(ids, 1);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: shotList,
      idGenerator: createDeterministicIdGenerator(),
    });
    const takeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      idGenerator: createDeterministicIdGenerator(),
    });
    const take = takeReport.overview.take;
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: take.takeId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    expect(report.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${ids.castMemberId}`,
          dependencyKind: 'cast-character-sheet',
          purpose: 'cast.character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
    expect(report.plan.dependencyInventory.dependencies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${extraCastMemberId}`,
        }),
      ])
    );
    const unselectedExtraCast = report.references.castMembers.find(
      (group) => group.castMemberId === extraCastMemberId
    );
    expect(unselectedExtraCast).toMatchObject({
      castMemberId: extraCastMemberId,
      selectedForShot: false,
      defaultSelectedForShot: false,
      characterSheets: [
        expect.objectContaining({
          assetId: null,
          selected: false,
          defaultSelected: false,
          card: expect.objectContaining({
            state: 'not-selected',
          }),
        }),
      ],
    });
    expect(
      unselectedExtraCast?.characterSheets[0]?.card.dependencyLineId
    ).toBeUndefined();

    await projectData.updateSceneShotVideoTakeDirection({
      homeDir,
      takeId: take.takeId,
      direction: {
        cast: { castMemberIds: [extraCastMemberId] },
      },
    });
    const updatedReport = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: take.takeId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });
    expect(updatedReport.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${extraCastMemberId}`,
          dependencyKind: 'cast-character-sheet',
          purpose: 'cast.character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
    expect(updatedReport.plan.dependencyInventory.dependencies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${ids.castMemberId}`,
        }),
      ])
    );
  });

  it('excludes voice-over cast members from shot character-sheet references', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    await shotVideoTakeProject.addCastToSceneNarrative({
      sceneId: ids.sceneId,
      extraCastMemberId: ids.narratorCastMemberId,
      locationId: ids.locationId,
    });
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    expect(report.references.castMembers.map((group) => group.castMemberId)).not.toContain(
      ids.narratorCastMemberId
    );
    expect(report.plan.dependencyInventory.dependencies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${ids.narratorCastMemberId}`,
        }),
      ])
    );
  });

  it('uses the selected lookbook sheet as the concrete ready reference input', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });
    await shotVideoTakeProject.writeProjectFile('generated/media/lookbook-sheet-a.png', 'sheet a');
    await shotVideoTakeProject.writeProjectFile('generated/media/lookbook-sheet-b.png', 'sheet b');
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

    await projectData.updateSceneShotVideoTakeLookbookSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      lookbookSheetId: sheetB.imported.id,
    });

    const production = {
      inputModeId: 'reference' as const,
      modelChoice: 'fal-ai/bytedance/seedance-2.0' as const,
      parameterValues: { duration: 6 },
    };
    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
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
    expect(preflight.plan?.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:lookbook-sheet:${lookbook.lookbook.id}`,
          availability: { state: 'satisfied' },
          dependencyKind: 'lookbook-sheet',
          selectedAsset: expect.objectContaining({
            assetId: sheetB.imported.asset.assetId,
            assetFileId: selectedSheetFile.id,
          }),
        }),
      ])
    );

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: written.take.takeId,
      production,
    });
    const sheetAChoice = report.references.lookbook.find(
      (choice) => choice.lookbookSheetId === sheetA.imported.id
    );
    const sheetBChoice = report.references.lookbook.find(
      (choice) => choice.lookbookSheetId === sheetB.imported.id
    );

    expect(sheetAChoice).toMatchObject({
      selected: false,
      card: {
        state: 'available',
      },
    });
    expect(sheetAChoice?.card.dependencyLineId).toBeUndefined();
    expect(sheetAChoice?.card.planLineId).toBeUndefined();
    expect(sheetBChoice).toMatchObject({
      selected: true,
      card: {
        state: 'selected-ready',
        dependencyLineId: `dependency:lookbook-sheet:${lookbook.lookbook.id}`,
      },
    });
  });

  it('shows shot-scoped planned reference image dependencies in the production plan', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'reference-image',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
      },
    });

    expect(report.references.general).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'reference-image',
          selected: true,
          card: expect.objectContaining({
            dependencyId: 'reference-image:shot:shot_001',
            state: 'selected-planned',
            pricing: expect.objectContaining({
              state: 'priced',
              estimatedUsd: 0.005,
            }),
          }),
        }),
      ])
    );
  });

  it('rejects excluding first-frame references required by the selected route', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const production = {
      inputModeId: 'first-frame' as const,
      modelChoice: 'fal-ai/bytedance/seedance-2.0' as const,
    };
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      production,
    });

    await expect(
      projectData.updateSceneShotVideoTakeReferenceInclusion({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        dependencyId: `first-frame:take:${written.take.takeId}`,
        inclusion: 'exclude',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA433',
    });
  });

  it('shows multiple imported image input takes once with one selected', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile('generated/media/first-frame-a.png', 'first frame a');
    await shotVideoTakeProject.writeProjectFile('generated/media/first-frame-b.png', 'first frame b');
    const selected = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/first-frame-a.png',
      selection: 'select',
    });
    await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/first-frame-b.png',
      selection: 'take',
    });
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        preparedInputs: [
          {
            kind: selected.mediaInput.kind,
            assetId: selected.mediaInput.assetId,
            assetFileId: selected.mediaInput.assetFileId,
            subjectKind: selected.mediaInput.subjectKind,
            subjectId: selected.mediaInput.subjectId,
          },
        ],
      },
    });

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: written.take.takeId,
    });

    const firstFrameChoices = report.references.general.filter(
      (choice) => choice.kind === 'first-frame'
    );
    expect(firstFrameChoices).toHaveLength(2);
    expect(firstFrameChoices.filter((choice) => choice.selected)).toHaveLength(1);
    expect(firstFrameChoices.find((choice) => choice.selected)?.card).toMatchObject({
      required: true,
      included: true,
    });
    expect(firstFrameChoices.find((choice) => !choice.selected)?.card).toMatchObject({
      required: false,
      included: false,
    });
    expect(
      firstFrameChoices.flatMap((choice) =>
        choice.card.previews.map((preview) => preview.inputId)
      )
    ).toHaveLength(2);
  });

  it('reports shot dialogue references as dialogue audio choices keyed by dialogue id', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const initialScreenplay = await projectData.readScreenplay({ homeDir });
    const initialScene =
      initialScreenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    await projectData.reviseScreenplayScene({
      homeDir,
      sceneId: ids.sceneId,
      document: {
        kind: 'screenplaySceneRevision',
        scene: {
          ...initialScene,
          blocks: [
            ...initialScene.blocks,
            {
              type: 'dialogue',
              dialogueId: 'dialogue_urban_line',
              castMemberId: ids.castMemberId,
              lines: ['Hold the line.'],
            },
            {
              type: 'dialogue',
              dialogueId: 'dialogue_mara_line',
              castMemberId: ids.castMemberId,
              lines: ['Keep your head down.'],
            },
          ],
        },
      },
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const dialogueBlockIndex = scene.blocks.findIndex(
      (block) => block.type === 'dialogue'
    );
    const dialogueBlock = scene.blocks[dialogueBlockIndex]!;
    const unselectedDialogueBlock = scene.blocks[dialogueBlockIndex + 1]!;
    if (
      dialogueBlock.type !== 'dialogue' ||
      unselectedDialogueBlock.type !== 'dialogue'
    ) {
      throw new Error('Expected sample scene to contain dialogue.');
    }
    const shotList = shotVideoTakeProject.sampleShotList(ids, 1);
    shotList.shots[0] = {
      ...shotList.shots[0]!,
      dialogue: [{ blockIndex: dialogueBlockIndex, purpose: 'spoken line' }],
    };
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: shotList,
      idGenerator: createDeterministicIdGenerator(),
    });
    const takeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      idGenerator: createDeterministicIdGenerator(),
    });
    const take = takeReport.overview.take;

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: take.takeId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      },
    });
    const expectedUrbanAudioEstimateUsd =
      dialogueBlock.lines.join('\n').length * 0.0001;

    expect(report.references.dialogueAudio).toEqual([
      expect.objectContaining({
        dependencyId: sceneDialogueAudioDependencyId(dialogueBlock.dialogueId),
        dialogueId: dialogueBlock.dialogueId,
        plainText: dialogueBlock.lines.join('\n'),
        pickedTake: null,
        takeCount: 0,
        audioState: 'not-generated',
        defaultIncluded: true,
        included: true,
        required: false,
        unavailableReason: 'Not generated yet',
        card: expect.objectContaining({
          state: 'selected-planned',
          defaultIncluded: true,
          included: true,
          pricing: expect.objectContaining({
            state: 'priced',
            estimatedUsd: expectedUrbanAudioEstimateUsd,
          }),
        }),
      }),
      expect.objectContaining({
        dependencyId: sceneDialogueAudioDependencyId(
          unselectedDialogueBlock.dialogueId
        ),
        dialogueId: unselectedDialogueBlock.dialogueId,
        plainText: unselectedDialogueBlock.lines.join('\n'),
        pickedTake: null,
        takeCount: 0,
        audioState: 'not-generated',
        defaultIncluded: false,
        included: false,
        required: false,
        unavailableReason: 'Not generated yet',
        card: expect.objectContaining({
          state: 'not-selected',
          defaultIncluded: false,
          included: false,
        }),
      }),
    ]);
    expect(report.references.dialogueAudioCapability).toMatchObject({
      state: 'ok',
      supported: true,
      selectedCount: 1,
      maxCount: 3,
      modelLabel: 'Seedance 2.0',
      message: 'Seedance 2.0 allows up to 3 audio references per generation',
    });
    expect(report.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyKind: 'reference-audio',
          purpose: 'scene.dialogue-audio',
          label: 'Mehmed II dialogue audio',
          availability: { state: 'missing-generated' },
          generationDraft: {
            state: 'missing-input',
            reason: 'Assign a Cast Voice before generating dialogue audio.',
          },
          pricing: expect.objectContaining({
            state: 'priced',
            estimatedUsd: expectedUrbanAudioEstimateUsd,
          }),
        }),
      ])
    );
    const audioLine = report.plan.dependencyInventory.dependencies.find(
      (line) => line.dependencyKind === 'reference-audio'
    );
    expect(report.plan.estimate.estimatedTotalUsd).toBeGreaterThanOrEqual(
      audioLine?.pricing.state === 'priced' ? audioLine.pricing.estimatedUsd : 0
    );
  });

  it('reads multi-cut reference selections from the selected shot while generation aggregates the take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const dialogueBlockIndex = scene.blocks.length;
    const dialogueBlock = {
      type: 'dialogue' as const,
      dialogueId: 'dialogue_scoped_reference',
      castMemberId: ids.castMemberId,
      lines: ['Hold the western gate.'],
    };
    await projectData.reviseScreenplayScene({
      homeDir,
      sceneId: ids.sceneId,
      document: {
        kind: 'screenplaySceneRevision',
        scene: {
          ...scene,
          blocks: [...scene.blocks, dialogueBlock],
        },
      },
    });
    const shotList = shotVideoTakeProject.sampleShotList(ids, 2);
    shotList.shots = shotList.shots.map((shot) => ({
      ...shot,
      dialogue: [{ blockIndex: dialogueBlockIndex, purpose: 'spoken line' }],
    }));
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: shotList,
      idGenerator: createDeterministicIdGenerator(),
    });
    const takeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
      idGenerator: createDeterministicIdGenerator(),
    });
    const take = takeReport.overview.take;
    await projectData.updateSceneShotVideoTakeStructureMode({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      mode: 'multi-cut',
    });

    await shotVideoTakeProject.writeProjectFile(
      'generated/media/cast-sheet-a.png',
      'cast sheet a'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/cast-sheet-b.png',
      'cast sheet b'
    );
    const characterSheetA = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/cast-sheet-a.png',
      title: 'Character Sheet A',
    });
    const characterSheetB = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/cast-sheet-b.png',
      title: 'Character Sheet B',
    });

    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const locationSheetFilesA =
      await shotVideoTakeProject.writeLocationSheetImportFiles(
        project.projectFolder,
        'location-sheet-a'
      );
    const locationSheetFilesB =
      await shotVideoTakeProject.writeLocationSheetImportFiles(
        project.projectFolder,
        'location-sheet-b'
      );
    const locationSheetA = await projectData.importLocationEnvironmentSheetMedia({
      homeDir,
      locationId: ids.locationId,
      sourceProjectRelativePath: locationSheetFilesA.primary,
      title: 'Location Sheet A',
      description: 'Primary environment sheet for shot one.',
    });
    const locationSheetB = await projectData.importLocationEnvironmentSheetMedia({
      homeDir,
      locationId: ids.locationId,
      sourceProjectRelativePath: locationSheetFilesB.primary,
      title: 'Location Sheet B',
      description: 'Primary environment sheet for shot two.',
    });

    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/lookbook-sheet-a.png',
      'lookbook sheet a'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/lookbook-sheet-b.png',
      'lookbook sheet b'
    );
    const lookbookSheetA = await projectData.importLookbookSheetMedia({
      homeDir,
      lookbookId: lookbook.lookbook.id,
      sourceProjectRelativePath: 'generated/media/lookbook-sheet-a.png',
      title: 'Lookbook Sheet A',
    });
    const lookbookSheetB = await projectData.importLookbookSheetMedia({
      homeDir,
      lookbookId: lookbook.lookbook.id,
      sourceProjectRelativePath: 'generated/media/lookbook-sheet-b.png',
      title: 'Lookbook Sheet B',
    });

    await shotVideoTakeProject.writeProjectFile(
      'generated/audio/urban-sample.mp3',
      'voice sample bytes'
    );
    const voice = await projectData.attachCastVoice({
      homeDir,
      document: {
        kind: 'castVoiceAttachment',
        castMemberId: ids.castMemberId,
        name: 'urban-primary',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        voiceId: 'voice_urban_primary',
        purpose: 'Primary speaking voice for scoped reference tests',
        sample: {
          sourceProjectRelativePath:
            'generated/audio/urban-sample.mp3' as ProjectRelativePath,
          title: 'Urban primary voice sample',
        },
      },
    });
    const audioInput = {
      homeDir,
      sceneId: ids.sceneId,
      dialogueId: dialogueBlock.dialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3' as const,
        castVoiceId: voice.voice.id,
        plainText: dialogueBlock.lines.join('\n'),
        v3Text: dialogueBlock.lines.join('\n'),
        outputFormat: 'mp3_44100_128' as const,
        languageCode: 'en',
      },
      simulate: true,
    };
    const firstAudio = await projectData.generateSceneDialogueAudioTake(audioInput);
    const secondAudio = await projectData.generateSceneDialogueAudioTake(audioInput);
    const firstAudioTakeId =
      firstAudio.context.audioByDialogueId[dialogueBlock.dialogueId]?.pickedTakeId;
    const secondAudioTakeId =
      secondAudio.context.audioByDialogueId[dialogueBlock.dialogueId]?.pickedTakeId;
    if (!firstAudioTakeId || !secondAudioTakeId) {
      throw new Error('Expected generated dialogue audio takes.');
    }

    await projectData.updateSceneShotVideoTakeCharacterSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_001',
      castMemberId: ids.castMemberId,
      assetId: characterSheetA.imported.assetId,
    });
    await projectData.updateSceneShotVideoTakeCharacterSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_002',
      castMemberId: ids.castMemberId,
      assetId: characterSheetB.imported.assetId,
    });
    await projectData.updateSceneShotVideoTakeLocationSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_001',
      locationId: ids.locationId,
      assetId: locationSheetA.imported.assetId,
    });
    await projectData.updateSceneShotVideoTakeLocationSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_002',
      locationId: ids.locationId,
      assetId: locationSheetB.imported.assetId,
    });
    await projectData.updateSceneShotVideoTakeLookbookSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_001',
      lookbookSheetId: lookbookSheetA.imported.id,
    });
    await projectData.updateSceneShotVideoTakeLookbookSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_002',
      lookbookSheetId: lookbookSheetB.imported.id,
    });
    await projectData.updateSceneShotVideoTakeDialogueAudioSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_001',
      dialogueId: dialogueBlock.dialogueId,
      dialogueAudioTakeId: firstAudioTakeId,
    });
    await projectData.updateSceneShotVideoTakeDialogueAudioSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_002',
      dialogueId: dialogueBlock.dialogueId,
      dialogueAudioTakeId: secondAudioTakeId,
    });
    const dependencyId = sceneDialogueAudioDependencyId(dialogueBlock.dialogueId);
    await projectData.updateSceneShotVideoTakeReferenceInclusion({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_001',
      dependencyId,
      inclusion: 'exclude',
    });
    await projectData.updateSceneShotVideoTakeReferenceInclusion({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      shotId: 'shot_002',
      dependencyId,
      inclusion: 'include',
    });

    const shotOneReport = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      selectedShotId: 'shot_001',
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      },
    });
    const shotTwoReport = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      selectedShotId: 'shot_002',
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      },
    });

    expect(
      shotOneReport.references.castMembers.find(
        (group) => group.castMemberId === ids.castMemberId
      )?.selectedCharacterSheetAssetId
    ).toBe(characterSheetA.imported.assetId);
    expect(
      shotTwoReport.references.castMembers.find(
        (group) => group.castMemberId === ids.castMemberId
      )?.selectedCharacterSheetAssetId
    ).toBe(characterSheetB.imported.assetId);
    expect(
      shotOneReport.references.locations.find(
        (group) => group.locationId === ids.locationId
      )?.selectedLocationSheetAssetId
    ).toBe(locationSheetA.imported.assetId);
    expect(
      shotTwoReport.references.locations.find(
        (group) => group.locationId === ids.locationId
      )?.selectedLocationSheetAssetId
    ).toBe(locationSheetB.imported.assetId);
    expect(
      shotOneReport.references.lookbook.find((choice) => choice.selected)
        ?.lookbookSheetId
    ).toBe(lookbookSheetA.imported.id);
    expect(
      shotTwoReport.references.lookbook.find((choice) => choice.selected)
        ?.lookbookSheetId
    ).toBe(lookbookSheetB.imported.id);
    expect(
      shotOneReport.references.dialogueAudio.find(
        (choice) => choice.dialogueId === dialogueBlock.dialogueId
      )?.pickedTake?.takeId
    ).toBe(firstAudioTakeId);
    expect(
      shotTwoReport.references.dialogueAudio.find(
        (choice) => choice.dialogueId === dialogueBlock.dialogueId
      )?.pickedTake?.takeId
    ).toBe(secondAudioTakeId);
    expect(
      shotOneReport.references.dialogueAudio.find(
        (choice) => choice.dialogueId === dialogueBlock.dialogueId
      )?.included
    ).toBe(false);
    expect(
      shotTwoReport.references.dialogueAudio.find(
        (choice) => choice.dialogueId === dialogueBlock.dialogueId
      )?.included
    ).toBe(true);
    expect(shotOneReport.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyKind: 'cast-character-sheet',
          selectedAsset: expect.objectContaining({
            assetId: characterSheetA.imported.assetId,
          }),
        }),
        expect.objectContaining({
          dependencyKind: 'cast-character-sheet',
          selectedAsset: expect.objectContaining({
            assetId: characterSheetB.imported.assetId,
          }),
        }),
        expect.objectContaining({
          dependencyKind: 'location-environment-sheet',
          selectedAsset: expect.objectContaining({
            assetId: locationSheetA.imported.assetId,
          }),
        }),
        expect.objectContaining({
          dependencyKind: 'location-environment-sheet',
          selectedAsset: expect.objectContaining({
            assetId: locationSheetB.imported.assetId,
          }),
        }),
      ])
    );
  });

  it('uses the named group reference inclusion policy for conflicting shot overrides', () => {
    expect(groupReferenceInclusionOverride([null, 'include', null])).toBe(
      'include'
    );
    expect(groupReferenceInclusionOverride([null, 'exclude', 'include'])).toBe(
      'exclude'
    );
    expect(groupReferenceInclusionOverride([null, null])).toBeNull();
  });

  it('reports unsupported dialogue audio capability before audio is generated', () => {
    const report = buildDialogueAudioCapabilityReport({
      plan: dialogueCapabilityPlan({
        inputRoles: [],
      }),
      choices: [
        dialogueCapabilityChoice({
          included: true,
          audioState: 'not-generated',
        }),
      ],
    });

    expect(report).toMatchObject({
      state: 'unsupported',
      supported: false,
      selectedCount: 1,
      maxCount: null,
      message: 'This model does not use audio references',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED',
          severity: 'warning',
        }),
      ],
    });
  });

  it('reports over-limit dialogue audio capability before final spec creation', () => {
    const report = buildDialogueAudioCapabilityReport({
      plan: dialogueCapabilityPlan({
        inputRoles: [
          {
            kind: 'audio',
            mediaKind: 'audio',
            required: false,
            minCount: 0,
            maxCount: 3,
          },
        ],
      }),
      choices: [
        dialogueCapabilityChoice({ dialogueId: 'dialogue_001' }),
        dialogueCapabilityChoice({ dialogueId: 'dialogue_002' }),
        dialogueCapabilityChoice({ dialogueId: 'dialogue_003' }),
        dialogueCapabilityChoice({ dialogueId: 'dialogue_004' }),
      ],
    });

    expect(report).toMatchObject({
      state: 'over-limit',
      supported: true,
      selectedCount: 4,
      maxCount: 3,
      message: 'Seedance 2.0 allows up to 3 audio references per generation',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
          severity: 'warning',
        }),
      ],
    });
  });
});

function takeReferenceSelections(
  take: SceneShotVideoTake
): SceneShotVideoTakeReferenceSelections {
  if (take.state.structure.mode === 'continuous') {
    return take.state.structure.sharedDirection.referenceSelections!;
  }
  return take.state.structure.directionsByShotId[take.shotIds[0]!]!
    .referenceSelections!;
}

function dialogueCapabilityPlan(input: {
  inputRoles: Array<{
    kind: string;
    mediaKind: string;
    required: boolean;
    minCount: number;
    maxCount?: number | null;
  }>;
}) {
  return {
    model: { label: 'Seedance 2.0' },
    route: { inputRoles: input.inputRoles },
  } as Parameters<typeof buildDialogueAudioCapabilityReport>[0]['plan'];
}

function dialogueCapabilityChoice(
  overrides: Partial<
    Parameters<typeof buildDialogueAudioCapabilityReport>[0]['choices'][number]
  > = {}
) {
  const dialogueId = overrides.dialogueId ?? 'dialogue_urban';
  return {
    dependencyId: sceneDialogueAudioDependencyId(dialogueId),
    dialogueId,
    castMemberId: 'cast_urban',
    speakerName: 'Urban',
    plainText: 'Hold the line.',
    audioState: 'ready',
    pickedTake: {
      takeId: 'take_001',
      takeLabel: 'Take 1',
      createdAt: '2026-06-12T10:00:00.000Z',
      assetId: 'asset_take_001',
      assetFileId: 'file_take_001',
    },
    takeCount: 1,
    defaultIncluded: true,
    included: true,
    required: false,
    unavailableReason: null,
    card: {
      state: 'selected-ready',
      mediaKind: 'audio',
      dependencyId: sceneDialogueAudioDependencyId(dialogueId),
      defaultIncluded: true,
      included: true,
      required: false,
      inclusionOverride: null,
      pricing: { state: 'not-applicable', estimatedUsd: null },
      previews: [],
      diagnostics: [],
    },
    ...overrides,
  } as Parameters<typeof buildDialogueAudioCapabilityReport>[0]['choices'][number];
}
