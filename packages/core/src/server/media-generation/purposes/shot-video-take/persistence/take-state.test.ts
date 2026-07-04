import { describe, expect, it } from 'vitest';
import {
  applyTakeStateToShot,
  carrySceneShotVideoTakeStateForShotMembership,
  emptySceneShotVideoTakeState,
  setSceneShotVideoTakeStructureMode,
  updateSceneShotVideoTakeDirection,
  updateSceneShotVideoTakeDirectionReferenceSelections,
} from './take-state.js';
import {
  sceneShotVideoTakeDirectionForShot,
} from '../shared/take-state-projections.js';

describe('scene shot video take state', () => {
  it('removes cleared optional custom shot design text before persistence', () => {
    const state = updateSceneShotVideoTakeDirection({
      state: emptySceneShotVideoTakeState(),
      direction: {
        composition: {
          shotSize: 'wide-shot',
          customComposition: '',
        },
        motion: {
          movement: 'push-in',
          customMotion: '   ',
        },
      },
    });

    expect(
      sceneShotVideoTakeDirectionForShot({ state, shotId: 'shot_001' })
    ).toMatchObject({
      composition: { shotSize: 'wide-shot' },
      motion: { movement: 'push-in' },
    });
  });

  it('removes the shot design entry when cleared custom text leaves no choices', () => {
    const state = updateSceneShotVideoTakeDirection({
      state: emptySceneShotVideoTakeState(),
      direction: {
        composition: { customComposition: '' },
        motion: { customMotion: '   ' },
      },
    });

    expect(
      sceneShotVideoTakeDirectionForShot({ state, shotId: 'shot_001' })
    ).toEqual({
      referenceSelections: {
        dependencyInclusions: {},
        selectedCharacterSheetAssetIds: {},
        selectedLocationSheetAssetIds: {},
        selectedLookbookSheetIds: [],
        selectedDialogueAudioTakeIds: {},
      },
    });
  });

  it('preserves reference selections when visual direction fields are cleared', () => {
    let state = updateSceneShotVideoTakeDirectionReferenceSelections({
      state: emptySceneShotVideoTakeState(),
      referenceSelections: {
        dependencyInclusions: {},
        selectedCharacterSheetAssetIds: {
          cast_urban: 'asset_character_sheet_001',
        },
        selectedLocationSheetAssetIds: {},
        selectedLookbookSheetIds: [],
        selectedDialogueAudioTakeIds: {},
      },
    });

    state = updateSceneShotVideoTakeDirection({
      state,
      direction: null,
    });

    expect(
      sceneShotVideoTakeDirectionForShot({ state, shotId: 'shot_001' })
    ).toEqual({
      referenceSelections: {
        dependencyInclusions: {},
        selectedCharacterSheetAssetIds: {
          cast_urban: 'asset_character_sheet_001',
        },
        selectedLocationSheetAssetIds: {},
        selectedLookbookSheetIds: [],
        selectedDialogueAudioTakeIds: {},
      },
    });
  });

  it('does not let visual direction updates replace reference selections', () => {
    let state = updateSceneShotVideoTakeDirectionReferenceSelections({
      state: emptySceneShotVideoTakeState(),
      referenceSelections: {
        dependencyInclusions: {},
        selectedCharacterSheetAssetIds: {
          cast_urban: 'asset_character_sheet_001',
        },
        selectedLocationSheetAssetIds: {},
        selectedLookbookSheetIds: [],
        selectedDialogueAudioTakeIds: {},
      },
    });

    state = updateSceneShotVideoTakeDirection({
      state,
      direction: {
        composition: { shotSize: 'wide-shot' },
        referenceSelections: {
          dependencyInclusions: {},
          selectedCharacterSheetAssetIds: {
            cast_urban: 'asset_unvalidated_replacement',
          },
          selectedLocationSheetAssetIds: {},
          selectedLookbookSheetIds: [],
          selectedDialogueAudioTakeIds: {},
        },
      },
    });

    expect(
      sceneShotVideoTakeDirectionForShot({ state, shotId: 'shot_001' })
        .referenceSelections
    ).toEqual({
      dependencyInclusions: {},
      selectedCharacterSheetAssetIds: {
        cast_urban: 'asset_character_sheet_001',
      },
      selectedLocationSheetAssetIds: {},
      selectedLookbookSheetIds: [],
      selectedDialogueAudioTakeIds: {},
    });
  });

  it('preserves baseline shot fields for empty take directions', () => {
    const projected = applyTakeStateToShot({
      shot: sourceShot(),
      state: emptySceneShotVideoTakeState(),
    });

    expect(projected).toMatchObject({
      shotType: 'Medium Close-Up',
      cameraAngle: 'Low Angle',
      framing: 'Single',
      lensIntent: 'Telephoto',
      cameraMovement: 'Push In',
    });
  });

  it('preserves baseline shot fields for reference-only take directions', () => {
    const state = updateSceneShotVideoTakeDirectionReferenceSelections({
      state: emptySceneShotVideoTakeState(),
      referenceSelections: {
        dependencyInclusions: {},
        selectedCharacterSheetAssetIds: {
          cast_urban: 'asset_character_sheet_001',
        },
        selectedLocationSheetAssetIds: {},
        selectedLookbookSheetIds: [],
        selectedDialogueAudioTakeIds: {},
      },
    });

    const projected = applyTakeStateToShot({
      shot: sourceShot(),
      state,
    });

    expect(projected).toMatchObject({
      shotType: 'Medium Close-Up',
      cameraAngle: 'Low Angle',
      framing: 'Single',
      lensIntent: 'Telephoto',
      cameraMovement: 'Push In',
    });
  });

  it('projects authored shot direction fields onto the source shot', () => {
    const state = updateSceneShotVideoTakeDirection({
      state: emptySceneShotVideoTakeState(),
      direction: {
        composition: {
          shotSize: 'wide-shot',
          cameraAngle: 'high-angle',
        },
        motion: {
          movement: 'tracking',
        },
      },
    });

    const projected = applyTakeStateToShot({
      shot: sourceShot(),
      state,
    });

    expect(projected).toMatchObject({
      shotType: 'Wide Shot',
      cameraAngle: 'High Angle',
      cameraMovement: 'Tracking',
    });
  });

  it('copies the shared continuous direction when switching to multi-cut', () => {
    const continuousState = updateSceneShotVideoTakeDirection({
      state: emptySceneShotVideoTakeState(),
      direction: {
        composition: { shotSize: 'wide-shot' },
      },
    });

    const multiCutState = setSceneShotVideoTakeStructureMode({
      state: continuousState,
      shotIds: ['shot_001', 'shot_002'],
      mode: 'multi-cut',
    });

    expect(multiCutState.structure).toEqual({
      mode: 'multi-cut',
      directionsByShotId: {
        shot_001: {
          composition: { shotSize: 'wide-shot' },
          referenceSelections: {
            dependencyInclusions: {},
            selectedCharacterSheetAssetIds: {},
            selectedLocationSheetAssetIds: {},
            selectedLookbookSheetIds: [],
            selectedDialogueAudioTakeIds: {},
          },
        },
        shot_002: {
          composition: { shotSize: 'wide-shot' },
          referenceSelections: {
            dependencyInclusions: {},
            selectedCharacterSheetAssetIds: {},
            selectedLocationSheetAssetIds: {},
            selectedLookbookSheetIds: [],
            selectedDialogueAudioTakeIds: {},
          },
        },
      },
    });
  });

  it('requires a source shot before collapsing divergent multi-cut directions', () => {
    let state = setSceneShotVideoTakeStructureMode({
      state: emptySceneShotVideoTakeState(),
      shotIds: ['shot_001', 'shot_002'],
      mode: 'multi-cut',
    });
    state = updateSceneShotVideoTakeDirection({
      state,
      shotId: 'shot_001',
      direction: { composition: { shotSize: 'wide-shot' } },
    });
    state = updateSceneShotVideoTakeDirection({
      state,
      shotId: 'shot_002',
      direction: { composition: { shotSize: 'close-up' } },
    });

    expect(() =>
      setSceneShotVideoTakeStructureMode({
        state,
        shotIds: ['shot_001', 'shot_002'],
        mode: 'continuous',
      })
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT',
      })
    );
  });

  it('uses the selected source shot when collapsing divergent multi-cut directions', () => {
    let state = setSceneShotVideoTakeStructureMode({
      state: emptySceneShotVideoTakeState(),
      shotIds: ['shot_001', 'shot_002'],
      mode: 'multi-cut',
    });
    state = updateSceneShotVideoTakeDirection({
      state,
      shotId: 'shot_001',
      direction: { composition: { shotSize: 'wide-shot' } },
    });
    state = updateSceneShotVideoTakeDirection({
      state,
      shotId: 'shot_002',
      direction: { composition: { shotSize: 'close-up' } },
    });

    const continuousState = setSceneShotVideoTakeStructureMode({
      state,
      shotIds: ['shot_001', 'shot_002'],
      mode: 'continuous',
      sourceShotId: 'shot_002',
    });

    expect(continuousState.structure).toEqual({
      mode: 'continuous',
      sharedDirection: {
        composition: { shotSize: 'close-up' },
        referenceSelections: {
          dependencyInclusions: {},
          selectedCharacterSheetAssetIds: {},
          selectedLocationSheetAssetIds: {},
          selectedLookbookSheetIds: [],
          selectedDialogueAudioTakeIds: {},
        },
      },
    });
  });

  it('keeps continuous direction shared when shot membership changes', () => {
    const state = updateSceneShotVideoTakeDirection({
      state: emptySceneShotVideoTakeState(),
      direction: { motion: { movement: 'push-in' } },
    });

    const carriedState = carrySceneShotVideoTakeStateForShotMembership({
      state,
      shots: [],
      previousShotIds: ['shot_001'],
      shotIds: ['shot_001', 'shot_002'],
    });

    expect(carriedState.structure).toEqual({
      mode: 'continuous',
      sharedDirection: {
        motion: { movement: 'push-in' },
        referenceSelections: {
          dependencyInclusions: {},
          selectedCharacterSheetAssetIds: {},
          selectedLocationSheetAssetIds: {},
          selectedLookbookSheetIds: [],
          selectedDialogueAudioTakeIds: {},
        },
      },
    });
  });
});

function sourceShot() {
  return {
    shotId: 'shot_001',
    title: 'Urban studies the bronze',
    storyBeat: 'Urban reads the cannon before anyone else does.',
    narrativePurpose: 'Show expertise before consequence.',
    description: 'Urban leans close to the bronze seam.',
    shotType: 'Medium Close-Up',
    cameraAngle: 'Low Angle',
    framing: 'Single',
    lensIntent: 'Telephoto',
    cameraMovement: 'Push In',
    subject: 'Urban and the bronze cannon',
    action: 'Urban studies the metal in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: ['cast_urban'],
    locationIds: ['location_gate'],
  };
}
