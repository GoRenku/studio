// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  SceneShotVideoTakeProductionState,
  SceneShotVideoTakeReferenceSelections,
  SceneShotVideoTakeDirection,
} from '@gorenku/studio-core/client';
import {
  createShotVideoTakeReferenceSelectionFixture,
  createShotVideoTakeStateE2eFixture,
  readPersistedShotVideoTake,
  updateShotVideoTakeGrouping,
  type ShotVideoTakeReferenceSelectionFixture,
  type ShotVideoTakeStateE2eFixture,
} from './testing/shot-video-take-state-e2e.test-fixture';
import {
  updateSceneShotVideoTakeDirection,
  planShotVideoTakeProduction,
  updateShotGroupReferenceInclusion,
  updateShotVideoTakeProduction,
  updateTakeCharacterSheetSelection,
  updateTakeDialogueAudioSelection,
  updateTakeLocationSheetSelection,
  updateTakeLookbookSheetSelection,
  updateSceneShotVideoTakeStructureMode,
} from './studio-shot-video-takes-api';

const SHOT_DESIGN_CASES: Array<{
  name: string;
  design: SceneShotVideoTakeDirection;
}> = [
  {
    name: 'composition choices',
    design: {
      composition: {
        shotSize: 'close-up',
        subjectFraming: ['single', 'over-the-shoulder'],
        cameraAngle: 'low-angle',
        dutch: 'left',
        lens: {
          type: 'normal',
          millimeters: 50,
          focus: 'shallow-focus',
        },
        customComposition:
          'Keep the cannon crew compressed against the wall.',
      },
    },
  },
  {
    name: 'motion choices',
    design: {
      motion: {
        movement: 'push-in',
        secondary: 'rack-focus',
        directions: ['forward', 'up'],
        track: 'straight',
        rig: 'dolly',
        customMotion: 'Begin locked, then creep toward the gate.',
      },
    },
  },
  {
    name: 'reference-bearing shot design choices',
    design: {
      cast: {
        castMemberIds: ['cast_test0001'],
        characterSheetAssetIds: {
          cast_test0001: 'asset_character_sheet_urban',
        },
      },
      location: {
        locationId: 'location_test0001',
        environmentSheetAssetIds: ['asset_location_sheet_gate'],
      },
      lookbook: {
        lookbookId: 'lookbook_imperial_wound',
        lookbookSheetId: 'lookbook_sheet_stone_pressure',
      },
      referenceImages: {
        customMediaInputIds: ['take_input_reference_001'],
      },
      dialogue: [
        {
          dialogueId: 'dialogue_order',
          inclusion: 'include',
          sceneDialogueAudioTakeId: 'dialogue_audio_take_001',
          assetId: 'asset_dialogue_audio_001',
          assetFileId: 'asset_file_dialogue_audio_001',
        },
      ],
    },
  },
];

describe('scene shot video take state persistence e2e', () => {
  let fixture: ShotVideoTakeStateE2eFixture;
  let referenceFixture: ShotVideoTakeReferenceSelectionFixture;

  beforeAll(async () => {
    fixture = await createShotVideoTakeStateE2eFixture();
    referenceFixture = await createShotVideoTakeReferenceSelectionFixture(fixture);
  });

  afterAll(() => {
    fixture.restoreFetch();
  });

  it.each(SHOT_DESIGN_CASES)(
    'persists $name across API reloads and grouping changes',
    async ({ design }) => {
      const take = await fixture.createTake({
        shotIds: ['shot_001'],
        title: 'Gate pressure take',
      });

      const savedDesign = await updateSceneShotVideoTakeDirection(
        fixture.projectName,
        fixture.ids.sceneId,
        take.takeId,
        design
      );

      const savedStructure = savedDesign.context.take.state.structure;
      expect(savedStructure.mode).toBe('continuous');
      if (savedStructure.mode === 'continuous') {
        expect(savedStructure.sharedDirection).toEqual(
          persistedDirection(design)
        );
      }
      await expectPersistedSharedDirection(take.takeId, persistedDirection(design));

      await updateShotVideoTakeGrouping(fixture, take.takeId, [
        'shot_001',
        'shot_002',
      ]);

      const groupedTake = await readPersistedShotVideoTake(fixture, take.takeId);
      expect(groupedTake.shotIds).toEqual(['shot_001', 'shot_002']);
      expect(groupedTake.state.structure).toEqual({
        mode: 'continuous',
        sharedDirection: persistedDirection(design),
      });
    }
  );

  it('persists reference selections across API reloads and grouping changes', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Reference selection take',
    });
    const inclusionDependencyId =
      `cast-character-sheet:${fixture.ids.castMemberId}:${referenceFixture.characterSheetAssetId}`;
    const expectedReferenceSelections: SceneShotVideoTakeReferenceSelections = {
      ...takeReferenceSelections(take),
      selectedCharacterSheetAssetIds: {
        [fixture.ids.castMemberId]: referenceFixture.characterSheetAssetId,
      },
      selectedLocationSheetAssetIds: {
        [fixture.ids.locationId]: referenceFixture.locationSheetAssetId,
      },
      selectedLookbookSheetIds: [referenceFixture.lookbookSheetId],
      dependencyInclusions: {
        [inclusionDependencyId]: 'exclude',
      },
    };

    await updateTakeCharacterSheetSelection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        castMemberId: fixture.ids.castMemberId,
        assetId: referenceFixture.characterSheetAssetId,
      }
    );
    await updateTakeLocationSheetSelection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        locationId: fixture.ids.locationId,
        assetId: referenceFixture.locationSheetAssetId,
      }
    );
    await updateTakeLookbookSheetSelection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      referenceFixture.lookbookSheetId
    );
    await updateShotVideoTakeProduction(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
      }
    );
    await updateShotGroupReferenceInclusion(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        dependencyId: inclusionDependencyId,
        inclusion: 'exclude',
      }
    );

    await expectPersistedReferenceSelections(
      take.takeId,
      expectedReferenceSelections
    );

    await updateShotVideoTakeGrouping(fixture, take.takeId, [
      'shot_001',
      'shot_002',
    ]);

    await expectPersistedReferenceSelections(
      take.takeId,
      expectedReferenceSelections
    );
  });

  it('persists dialogue audio selection, clear behavior, and inclusion choices', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Dialogue selection take',
    });
    await updateShotVideoTakeProduction(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { generate_audio: true },
      }
    );
    await updateTakeDialogueAudioSelection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        dialogueId: fixture.ids.dialogueId,
        takeId: referenceFixture.dialogueAudioTakeId,
      }
    );
    const plan = await planShotVideoTakeProduction(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const dialogueDependencyId = plan.references.dialogueAudio.find(
      (choice) => choice.dialogueId === fixture.ids.dialogueId
    )?.dependencyId;
    expect(dialogueDependencyId).toBeTruthy();
    await updateShotGroupReferenceInclusion(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        dependencyId: dialogueDependencyId!,
        inclusion: 'include',
      }
    );

    let persisted = await readPersistedShotVideoTake(fixture, take.takeId);
    expect(
      takeReferenceSelections(persisted).selectedDialogueAudioTakeIds
    ).toEqual({
      [fixture.ids.dialogueId]: referenceFixture.dialogueAudioTakeId,
    });
    expect(takeReferenceSelections(persisted).dependencyInclusions).toEqual({
      [dialogueDependencyId!]: 'include',
    });

    await updateTakeDialogueAudioSelection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        dialogueId: fixture.ids.dialogueId,
        takeId: null,
      }
    );
    await updateShotVideoTakeGrouping(fixture, take.takeId, [
      'shot_001',
      'shot_002',
    ]);

    persisted = await readPersistedShotVideoTake(fixture, take.takeId);
    expect(
      takeReferenceSelections(persisted).selectedDialogueAudioTakeIds
    ).toEqual({});
    expect(takeReferenceSelections(persisted).dependencyInclusions).toEqual({
      [dialogueDependencyId!]: 'include',
    });
  });

  it('persists AI Production choices across API reloads and grouping changes', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'AI Production persistence take',
    });
    const production: SceneShotVideoTakeProductionState = {
      inputModeId: 'first-frame',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      parameterValues: {
        duration: 9,
        aspect_ratio: '16:9',
        resolution: '720p',
        generate_audio: true,
      },
    };

    const savedProduction = await updateShotVideoTakeProduction(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      production
    );
    expect(savedProduction.context.take.state.production).toEqual(production);

    await expectPersistedProduction(take.takeId, production);

    await updateShotVideoTakeGrouping(fixture, take.takeId, [
      'shot_001',
      'shot_002',
    ]);

    await expectPersistedProduction(take.takeId, production);
  });

  it('clears empty multi-cut directions and prunes directions for removed shots', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001', 'shot_002'],
      title: 'Prune removed direction take',
    });

    await updateSceneShotVideoTakeStructureMode(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      'multi-cut'
    );
    await updateSceneShotVideoTakeDirection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      SHOT_DESIGN_CASES[0]!.design,
      'shot_001'
    );
    await updateSceneShotVideoTakeDirection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      SHOT_DESIGN_CASES[1]!.design,
      'shot_002'
    );

    const cleared = await updateSceneShotVideoTakeDirection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      null,
      'shot_002'
    );
    expect(cleared.context.take.state.structure).toEqual({
      mode: 'multi-cut',
      directionsByShotId: {
        shot_001: persistedDirection(SHOT_DESIGN_CASES[0]!.design),
        shot_002: { referenceSelections: emptyReferenceSelections() },
      },
    });

    await updateShotVideoTakeGrouping(fixture, take.takeId, ['shot_002']);

    const prunedTake = await readPersistedShotVideoTake(fixture, take.takeId);
    expect(prunedTake.shotIds).toEqual(['shot_002']);
    expect(prunedTake.state.structure).toEqual({
      mode: 'multi-cut',
      directionsByShotId: {
        shot_002: { referenceSelections: emptyReferenceSelections() },
      },
    });
  });

  it('returns a structured error and does not persist invalid reference ids', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Invalid reference take',
    });

    await expect(
      updateTakeCharacterSheetSelection(
        fixture.projectName,
        fixture.ids.sceneId,
        take.takeId,
        {
          castMemberId: fixture.ids.castMemberId,
          assetId: 'asset_missing',
        }
      )
    ).rejects.toThrow(
      'PROJECT_DATA425: Character sheet asset does not belong to the requested Cast Member.'
    );

    const persisted = await readPersistedShotVideoTake(fixture, take.takeId);
    expect(
      takeReferenceSelections(persisted).selectedCharacterSheetAssetIds
    ).toEqual({});
  });

  async function expectPersistedSharedDirection(
    takeId: string,
    direction: SceneShotVideoTakeDirection
  ) {
    const persisted = await readPersistedShotVideoTake(fixture, takeId);
    expect(persisted.state.structure).toEqual({
      mode: 'continuous',
      sharedDirection: direction,
    });
  }

  async function expectPersistedReferenceSelections(
    takeId: string,
    expected: SceneShotVideoTakeReferenceSelections
  ) {
    const persisted = await readPersistedShotVideoTake(fixture, takeId);
    expect(takeReferenceSelections(persisted)).toEqual(expected);
  }

  async function expectPersistedProduction(
    takeId: string,
    production: SceneShotVideoTakeProductionState
  ) {
    const persisted = await readPersistedShotVideoTake(fixture, takeId);
    expect(persisted.state.production).toEqual(production);
  }
});

function takeReferenceSelections(
  take: Pick<Awaited<ReturnType<typeof readPersistedShotVideoTake>>, 'state' | 'shotIds'>
): SceneShotVideoTakeReferenceSelections {
  if (take.state.structure.mode === 'continuous') {
    return (
      take.state.structure.sharedDirection.referenceSelections ??
      emptyReferenceSelections()
    );
  }
  const firstShotId = take.shotIds[0]!;
  return (
    take.state.structure.directionsByShotId[firstShotId]?.referenceSelections ??
    emptyReferenceSelections()
  );
}

function emptyReferenceSelections(): SceneShotVideoTakeReferenceSelections {
  return {
    dependencyInclusions: {},
    selectedCharacterSheetAssetIds: {},
    selectedLocationSheetAssetIds: {},
    selectedLookbookSheetIds: [],
    selectedDialogueAudioTakeIds: {},
  };
}

function persistedDirection(
  direction: SceneShotVideoTakeDirection
): SceneShotVideoTakeDirection {
  return {
    ...direction,
    referenceSelections:
      direction.referenceSelections ?? emptyReferenceSelections(),
  };
}
