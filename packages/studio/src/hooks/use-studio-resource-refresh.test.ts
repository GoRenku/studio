import { describe, expect, it } from 'vitest';
import {
  matchesActStoryboardResource,
  matchesCastMemberResource,
  matchesCastOverviewResource,
  matchesLocationOverviewResource,
  matchesLocationResource,
  matchesSceneBeatsResource,
  matchesSequenceResource,
  matchesVisualLanguageLookbookResource,
} from './use-studio-resource-refresh';

describe('Studio resource refresh matchers', () => {
  it('matches broad Beat Sheet changes for the Scene Beats surface', () => {
    expect(
      matchesSceneBeatsResource({
        resourceKeys: ['scene-beat-sheet'],
        sceneId: 'scene_bombardment',
        beatSheetId: 'scene_beat_sheet_bombardment',
      })
    ).toBe(true);
  });

  it('matches broad Beat Sheet changes for storyboard surfaces', () => {
    expect(
      matchesSequenceResource({
        resourceKeys: ['scene-beat-sheet'],
        sequenceId: 'sequence_siege',
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
    expect(
      matchesActStoryboardResource({
        resourceKeys: ['scene-beat-sheet'],
        actId: 'act_one',
        sequenceIds: new Set(['sequence_siege']),
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
  });

  it('matches current owner surfaces and rejects retired asset and design keys', () => {
    expect(matchesCastOverviewResource(['surface:castMember:cast_urban'])).toBe(true);
    expect(
      matchesCastMemberResource(['surface:castMember:cast_urban'], 'cast_urban')
    ).toBe(true);
    expect(matchesLocationOverviewResource(['surface:location:location_gate'])).toBe(true);
    expect(
      matchesLocationResource(['surface:location:location_gate'], 'location_gate')
    ).toBe(true);

    for (const removedKey of [
      'assets:castMember:cast_urban',
      'surface:castDesign:cast_urban',
      'assets:location:location_gate',
      'surface:locationDesign:location_gate',
    ]) {
      expect(matchesCastOverviewResource([removedKey])).toBe(false);
      expect(matchesCastMemberResource([removedKey], 'cast_urban')).toBe(false);
      expect(matchesLocationOverviewResource([removedKey])).toBe(false);
      expect(matchesLocationResource([removedKey], 'location_gate')).toBe(false);
    }
  });

  it('matches only the current Lookbook or the collection resource', () => {
    expect(
      matchesVisualLanguageLookbookResource(
        ['surface:visual-language:lookbook:lookbook_movie'],
        'lookbook_movie'
      )
    ).toBe(true);
    expect(
      matchesVisualLanguageLookbookResource(
        ['surface:visual-language:lookbook:lookbook_storyboard'],
        'lookbook_movie'
      )
    ).toBe(false);
    expect(
      matchesVisualLanguageLookbookResource(
        ['surface:visual-language:lookbooks'],
        'lookbook_movie'
      )
    ).toBe(true);
  });

  it('matches the affected Scene Beats surface in Scene, Sequence, and Act projections', () => {
    const resourceKeys = ['surface:scene:scene_bombardment:beats'];
    expect(
      matchesSceneBeatsResource({
        resourceKeys,
        sceneId: 'scene_bombardment',
      })
    ).toBe(true);
    expect(
      matchesSequenceResource({
        resourceKeys,
        sequenceId: 'sequence_siege',
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
    expect(
      matchesActStoryboardResource({
        resourceKeys,
        actId: 'act_one',
        sequenceIds: new Set(['sequence_siege']),
        sceneIds: new Set(['scene_bombardment']),
      })
    ).toBe(true);
  });
});
