import { describe, expect, it } from 'vitest';
import type { SceneShotVideoTakeTarget } from '../../../client/index.js';
import {
  castCharacterSheetDependencySlot,
  locationEnvironmentSheetDependencySlot,
  lookbookSheetDependencySlot,
  shotVideoInputDependencySlot,
} from './dependency-slot-definitions.js';

const takeTarget: SceneShotVideoTakeTarget = {
  kind: 'sceneShotVideoTake',
  id: 'scene-a:take-a',
  sceneId: 'scene-a',
  takeId: 'take-a',
  shotIds: ['shot-a'],
};

describe('media generation dependency slot definitions', () => {
  it('builds Cast Character Sheet dependency slots with selected asset targeting', () => {
    expect(
      castCharacterSheetDependencySlot({
        castMemberId: 'cast-a',
        castMemberName: 'Ada',
        assetId: 'asset-a',
        selectionPolicy: 'selected-only',
        required: true,
        reason: 'Ada appears in the shot.',
      })
    ).toEqual({
      dependencyId: 'cast-character-sheet:cast-a:asset-a',
      dependencyKind: 'cast-character-sheet',
      label: 'Ada character sheet',
      dependencyTarget: { kind: 'castMember', id: 'cast-a' },
      selector: {
        kind: 'asset-relationship',
        target: { kind: 'castMember', castMemberId: 'cast-a' },
        assetId: 'asset-a',
        role: 'character_sheet',
        mediaKind: 'image',
        selectionPolicy: 'selected-only',
      },
      required: true,
      reason: 'Ada appears in the shot.',
    });
  });

  it('builds Location Sheet and Lookbook Sheet dependency slots', () => {
    expect(
      locationEnvironmentSheetDependencySlot({
        locationId: 'location-a',
        locationName: 'Archive',
        assetId: 'asset-location',
        assetTitle: 'Night version',
        required: false,
        reason: 'Optional reference.',
      })
    ).toMatchObject({
      dependencyId: 'location-environment-sheet:location-a:asset-location',
      label: 'Archive Location Sheet: Night version',
      selector: {
        kind: 'asset-relationship',
        role: 'environment_sheet',
        fileRole: 'primary',
        selectionPolicy: 'selected-only',
      },
    });

    expect(
      lookbookSheetDependencySlot({
        lookbookId: 'lookbook-a',
        lookbookName: 'Nocturne',
        lookbookSheetId: 'sheet-a',
        required: true,
        reason: 'Style reference.',
      })
    ).toMatchObject({
      dependencyId: 'lookbook-sheet:lookbook-a',
      dependencyKind: 'lookbook-sheet',
      label: 'Nocturne Lookbook sheet',
      selector: {
        kind: 'lookbook-sheet',
        lookbookId: 'lookbook-a',
        lookbookSheetId: 'sheet-a',
        selectionPolicy: 'selected-or-default',
      },
    });
  });

  it('builds shot video input slots with the right dependency kind and fallback labels', () => {
    expect(
      shotVideoInputDependencySlot({
        kind: 'first-frame',
        target: takeTarget,
        required: true,
        reason: 'Route requires a first frame.',
      })
    ).toMatchObject({
      dependencyId: 'first-frame:take:take-a',
      dependencyKind: 'first-frame',
      label: 'First frame',
      selector: {
        kind: 'shot-video-input',
        inputKind: 'first-frame',
        takeId: 'take-a',
        shotIds: ['shot-a'],
      },
    });

    expect(
      shotVideoInputDependencySlot({
        kind: 'audio',
        target: takeTarget,
        subjectKind: 'scene-dialogue',
        subjectId: 'dialogue-a',
        required: false,
        reason: 'Optional dialogue reference.',
      })
    ).toMatchObject({
      dependencyId: 'audio:scene-dialogue:dialogue-a',
      dependencyKind: 'reference-audio',
      label: 'Dialogue audio',
    });

    expect(
      shotVideoInputDependencySlot({
        kind: 'audio',
        target: takeTarget,
        label: 'Temp track',
        required: false,
        reason: 'Optional temp audio.',
      })
    ).toMatchObject({
      dependencyKind: 'manual-attachment',
      label: 'Temp track',
    });
  });
});
