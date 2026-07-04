import { describe, expect, it } from 'vitest';
import type { SceneShotVideoTakeTarget } from '../../../client/index.js';
import {
  castCharacterSheetDependencyId,
  dependencyKindForShotVideoInput,
  locationEnvironmentSheetDependencyId,
  lookbookSheetDependencyId,
  parseShotVideoInputDependencyId,
  sceneDialogueAudioDependencyId,
  shotVideoInputDependencyId,
} from './dependency-identifiers.js';

const takeTarget: SceneShotVideoTakeTarget = {
  kind: 'sceneShotVideoTake',
  id: 'scene-a:take-a',
  sceneId: 'scene-a',
  takeId: 'take-a',
  shotIds: ['shot-a'],
};

describe('media generation dependency identifiers', () => {
  it('builds canonical dependency ids for shared generated dependencies', () => {
    expect(castCharacterSheetDependencyId('cast-a')).toBe(
      'cast-character-sheet:cast-a'
    );
    expect(castCharacterSheetDependencyId('cast-a', 'asset-a')).toBe(
      'cast-character-sheet:cast-a:asset-a'
    );
    expect(locationEnvironmentSheetDependencyId('location-a', 'asset-b')).toBe(
      'location-environment-sheet:location-a:asset-b'
    );
    expect(lookbookSheetDependencyId('lookbook-a')).toBe(
      'lookbook-sheet:lookbook-a'
    );
    expect(sceneDialogueAudioDependencyId('dialogue-a')).toBe(
      'audio:scene-dialogue:dialogue-a'
    );
  });

  it('uses take id fallback for shot video inputs and explicit subject ids when present', () => {
    expect(
      shotVideoInputDependencyId({
        kind: 'first-frame',
        target: takeTarget,
      })
    ).toBe('first-frame:take:take-a');

    expect(
      shotVideoInputDependencyId({
        kind: 'reference-image',
        subjectKind: 'shot',
        subjectId: 'shot-a',
      })
    ).toBe('reference-image:shot:shot-a');
  });

  it('parses canonical generated dependency ids', () => {
    expect(parseShotVideoInputDependencyId('cast-character-sheet:cast-a:asset-a'))
      .toEqual({
        ok: true,
        value: {
          kind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: 'cast-a',
          assetId: 'asset-a',
        },
      });
    expect(parseShotVideoInputDependencyId('first-frame:take:take-a')).toEqual({
      ok: true,
      value: {
        kind: 'first-frame',
        subjectKind: 'take',
        subjectId: 'take-a',
      },
    });
    expect(parseShotVideoInputDependencyId('audio:scene-dialogue:dialogue-a'))
      .toEqual({
        ok: true,
        value: {
          kind: 'audio',
          subjectKind: 'scene-dialogue',
          subjectId: 'dialogue-a',
        },
      });
  });

  it('reports empty, unsupported, and malformed dependency ids', () => {
    expect(parseShotVideoInputDependencyId(undefined)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(parseShotVideoInputDependencyId('unknown-kind:take:take-a')).toEqual({
      ok: false,
      reason: 'unsupported-kind',
    });
    expect(parseShotVideoInputDependencyId('first-frame:take:take-a:extra'))
      .toEqual({
        ok: false,
        reason: 'malformed',
      });
  });

  it('maps shot video input kinds onto dependency kinds', () => {
    expect(dependencyKindForShotVideoInput('character-sheet', 'cast-member'))
      .toBe('cast-character-sheet');
    expect(dependencyKindForShotVideoInput('location-sheet', 'location')).toBe(
      'location-environment-sheet'
    );
    expect(dependencyKindForShotVideoInput('lookbook-sheet', 'lookbook')).toBe(
      'lookbook-sheet'
    );
    expect(dependencyKindForShotVideoInput('audio', 'scene-dialogue')).toBe(
      'reference-audio'
    );
    expect(dependencyKindForShotVideoInput('source-video')).toBe(
      'manual-attachment'
    );
  });
});
