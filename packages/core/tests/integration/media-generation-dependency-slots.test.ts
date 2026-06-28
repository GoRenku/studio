import { describe, expect, it } from 'vitest';
import { declareCastProfileDependencySlots } from '../../src/server/media-generation/cast-profile-dependency-slots.js';
import {
  parseShotVideoInputDependencyId,
  shotVideoInputDependencyId,
} from '../../src/server/media-generation/dependency-identifiers.js';
import { declareShotVideoTakeDependencySlots } from '../../src/server/media-generation/shot-video-take/dependency-slots.js';
import type { SceneShotVideoTakeTarget } from '../../src/client/index.js';

const target: SceneShotVideoTakeTarget = {
  kind: 'sceneShotVideoTake',
  id: 'take',
  sceneId: 'scene',
  takeId: 'take',
  shotIds: ['shot-a'],
};

const selectedCast = [{ id: 'cast-a', name: 'Ada' }];
const selectedLocations = [{ id: 'location-a', name: 'Archive' }];
const activeLookbook = { id: 'lookbook-a', name: 'Nocturne' };
const selectedCharacterSheetAssetIdsByCastMember = {};
const selectedLocationSheetAssetIdsByLocation = {
  'location-a': ['asset-location-sheet-a'],
};

describe('media generation dependency slot declarations', () => {
  it('declares no required frame-input slots for shot video text-only mode', () => {
    const slots = declareShotVideoTakeDependencySlots({
      target,
      inputModeId: 'text-only',
      selectedCast,
      selectedLocations,
      activeLookbook,
      customReferenceInputs: [],
      selectedCharacterSheetAssetIdsByCastMember,
      selectedLocationSheetAssetIdsByLocation,
    });

    expect(slots.filter((slot) => slot.required)).toEqual([]);
    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyId: 'cast-character-sheet:cast-a',
          required: false,
          selector: expect.objectContaining({
            selectionPolicy: 'selected-only',
          }),
        }),
        expect.objectContaining({
          dependencyId: 'location-environment-sheet:location-a:asset-location-sheet-a',
          required: false,
          selector: expect.objectContaining({
            assetId: 'asset-location-sheet-a',
            selectionPolicy: 'selected-only',
          }),
        }),
        expect.objectContaining({
          dependencyId: 'lookbook-sheet:lookbook-a',
          required: false,
          selector: expect.objectContaining({
            selectionPolicy: 'selected-or-default',
          }),
        }),
      ])
    );
  });

  it('declares first frame as required for shot video first-frame mode', () => {
    const slots = declareShotVideoTakeDependencySlots({
      target,
      inputModeId: 'first-frame',
      selectedCast,
      selectedLocations,
      activeLookbook,
      customReferenceInputs: [],
      selectedCharacterSheetAssetIdsByCastMember,
      selectedLocationSheetAssetIdsByLocation,
    });

    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyId: 'first-frame:take:take',
          dependencyKind: 'first-frame',
          required: true,
          selector: expect.objectContaining({ kind: 'shot-video-input' }),
        }),
      ])
    );
  });

  it('preserves cast and location context when no Lookbook is active', () => {
    const slots = declareShotVideoTakeDependencySlots({
      target,
      inputModeId: 'first-frame',
      selectedCast,
      selectedLocations,
      activeLookbook: null,
      customReferenceInputs: [],
      selectedCharacterSheetAssetIdsByCastMember,
      selectedLocationSheetAssetIdsByLocation,
    });

    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyId: 'first-frame:take:take',
          required: true,
        }),
        expect.objectContaining({
          dependencyId: 'cast-character-sheet:cast-a',
          required: false,
        }),
        expect.objectContaining({
          dependencyId: 'location-environment-sheet:location-a:asset-location-sheet-a',
          required: false,
        }),
      ])
    );
    expect(slots).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyId: 'lookbook-sheet:lookbook-a',
        }),
      ])
    );
  });

  it('declares first and last frame as required for shot video first-last-frame mode', () => {
    const slots = declareShotVideoTakeDependencySlots({
      target,
      inputModeId: 'first-last-frame',
      selectedCast,
      selectedLocations,
      activeLookbook,
      customReferenceInputs: [],
      selectedCharacterSheetAssetIdsByCastMember,
      selectedLocationSheetAssetIdsByLocation,
    });

    expect(slots.filter((slot) => slot.required).map((slot) => slot.dependencyKind)).toEqual([
      'first-frame',
      'last-frame',
    ]);
  });

  it('declares selected reference bundle dependencies as optional for reference mode', () => {
    const slots = declareShotVideoTakeDependencySlots({
      target,
      inputModeId: 'reference',
      selectedCast,
      selectedLocations,
      activeLookbook,
      customReferenceInputs: [{ id: 'reference-a', title: 'Map table reference' }],
      selectedCharacterSheetAssetIdsByCastMember,
      selectedLocationSheetAssetIdsByLocation,
    });

    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyId: 'reference-image:asset:reference-a',
          required: false,
        }),
        expect.objectContaining({
          dependencyId: 'lookbook-sheet:lookbook-a',
          required: false,
        }),
        expect.objectContaining({
          dependencyId: 'cast-character-sheet:cast-a',
          required: false,
        }),
        expect.objectContaining({
          dependencyId: 'location-environment-sheet:location-a:asset-location-sheet-a',
          required: false,
        }),
      ])
    );
  });

  it('does not copy an active Lookbook sheet onto a requested different Lookbook', () => {
    const slots = declareShotVideoTakeDependencySlots({
      target,
      inputModeId: 'text-only',
      selectedCast: [],
      selectedLocations: [],
      activeLookbook: {
        id: 'lookbook-a',
        name: 'Nocturne',
        selectedSheetId: 'lookbook-a-sheet',
      },
      customReferenceInputs: [],
      selectedCharacterSheetAssetIdsByCastMember: {},
      selectedLocationSheetAssetIdsByLocation: {},
      requestedInputs: [
        {
          kind: 'lookbook-sheet',
          subjectKind: 'lookbook',
          subjectId: 'lookbook-b',
        },
      ],
    });

    const requestedLookbookSlot = slots.find(
      (slot) => slot.dependencyId === 'lookbook-sheet:lookbook-b'
    );

    expect(requestedLookbookSlot).toMatchObject({
      dependencyId: 'lookbook-sheet:lookbook-b',
      dependencyKind: 'lookbook-sheet',
      selector: {
        kind: 'lookbook-sheet',
        lookbookId: 'lookbook-b',
        selectionPolicy: 'selected-or-default',
      },
    });
    expect(requestedLookbookSlot?.selector).not.toHaveProperty('lookbookSheetId');
    expect(
      slots.find((slot) => slot.dependencyId === 'lookbook-sheet:lookbook-a')
    ).toMatchObject({
      selector: expect.objectContaining({
        lookbookSheetId: 'lookbook-a-sheet',
      }),
    });
  });

  it('declares cast profile character sheet as required', () => {
    expect(
      declareCastProfileDependencySlots({
        castMemberId: 'cast-a',
        castMemberName: 'Ada',
      })
    ).toEqual([
      expect.objectContaining({
        dependencyId: 'cast-character-sheet:cast-a',
        dependencyKind: 'cast-character-sheet',
        required: true,
        selector: expect.objectContaining({
          kind: 'asset-relationship',
          role: 'character_sheet',
          selectionPolicy: 'selected-or-default',
        }),
      }),
    ]);
  });

  it('builds and parses shot video dependency ids through the central contract', () => {
    const dependencyId = shotVideoInputDependencyId({
      kind: 'first-frame',
      target,
    });

    expect(dependencyId).toBe('first-frame:take:take');
    expect(parseShotVideoInputDependencyId(dependencyId)).toEqual({
      ok: true,
      value: {
        kind: 'first-frame',
        subjectKind: 'take',
        subjectId: 'take',
      },
    });
    expect(parseShotVideoInputDependencyId('not-a-real-kind:asset:a')).toEqual({
      ok: false,
      reason: 'unsupported-kind',
    });
  });
});
