import { describe, expect, it } from 'vitest';
import {
  matchesCastMemberResource,
  matchesCastOverviewResource,
  matchesLocationOverviewResource,
  matchesLocationResource,
  matchesMovieStudioNavigationResource,
  matchesSceneBeatsResource,
  matchesSceneNarrativeResource,
  matchesVisualLanguageLookbookResource,
} from './use-studio-resource-refresh';

describe('Studio resource refresh matchers', () => {
  it('matches every continuity navigation resource', () => {
    expect(matchesMovieStudioNavigationResource(['navigation:cast'])).toBe(true);
    expect(matchesMovieStudioNavigationResource(['navigation:locations'])).toBe(true);
    expect(matchesMovieStudioNavigationResource(['navigation:props'])).toBe(true);
  });

  it('matches broad Scene Beats revision changes for the Scene Beats surface', () => {
    expect(
      matchesSceneBeatsResource({
        resourceKeys: ['scene-beats'],
        sceneId: 'scene_bombardment',
        sceneBeatsRevisionId: 'scene_beats_revision_bombardment',
      })
    ).toBe(true);
  });

  it('matches screenplay structure and Section changes for navigation', () => {
    expect(matchesMovieStudioNavigationResource(['screenplay:structure'])).toBe(true);
    expect(
      matchesMovieStudioNavigationResource(['screenplay:section:section_siege'])
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

  it('refreshes the Scene narrative projection when entity preview images change', () => {
    expect(
      matchesSceneNarrativeResource(
        ['surface:castMember:cast_urban'],
        'scene_bombardment'
      )
    ).toBe(true);
    expect(
      matchesSceneNarrativeResource(
        ['surface:location:location_gate'],
        'scene_bombardment'
      )
    ).toBe(true);
    expect(
      matchesSceneNarrativeResource(
        ['surface:visual-language:lookbooks'],
        'scene_bombardment'
      )
    ).toBe(false);
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

  it('matches the affected Scene Beats surface', () => {
    const resourceKeys = ['surface:scene:scene_bombardment:beats'];
    expect(
      matchesSceneBeatsResource({
        resourceKeys,
        sceneId: 'scene_bombardment',
      })
    ).toBe(true);
  });
});
