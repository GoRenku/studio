import { describe, expect, it } from 'vitest';
import {
  studioCastDesignResourceKey,
  studioCastMemberAssetsResourceKey,
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
  studioLocationAssetsResourceKey,
  studioLocationDesignResourceKey,
  studioLocationNavigationResourceKey,
  studioLocationSurfaceResourceKey,
  studioProjectInformationResourceKey,
  studioProjectLibraryResourceKey,
  studioProjectShellResourceKey,
  studioSceneNarrativeResourceKey,
  studioSceneShotListResourceKey,
  studioSceneShotResourceKey,
  studioSceneShotsResourceKey,
  studioScreenplayActsResourceKey,
  studioScreenplayResourceKey,
  studioSequenceScenesNavigationResourceKey,
  studioVisualLanguageInspirationFolderResourceKey,
  studioVisualLanguageInspirationResourceKey,
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from './resource-keys.js';

describe('Studio resource key catalog', () => {
  it('builds accepted project and navigation resource keys', () => {
    expect(studioProjectShellResourceKey()).toBe('project-shell');
    expect(studioProjectLibraryResourceKey()).toBe('project-library');
    expect(studioProjectInformationResourceKey()).toBe('project-information');
    expect(studioCastNavigationResourceKey()).toBe('navigation:cast');
    expect(studioLocationNavigationResourceKey()).toBe('navigation:locations');
    expect(studioScreenplayResourceKey()).toBe('screenplay');
    expect(studioScreenplayActsResourceKey()).toBe('screenplay:acts');
    expect(studioSequenceScenesNavigationResourceKey('seq_opening')).toBe(
      'navigation:sequence-scenes:seq_opening'
    );
  });

  it('builds accepted surface and asset resource keys', () => {
    expect(studioCastMemberSurfaceResourceKey('cast_urban')).toBe(
      'surface:castMember:cast_urban'
    );
    expect(studioCastMemberAssetsResourceKey('cast_urban')).toBe(
      'assets:castMember:cast_urban'
    );
    expect(studioCastDesignResourceKey('cast_urban')).toBe(
      'surface:castDesign:cast_urban'
    );
    expect(studioLocationSurfaceResourceKey('location_gate')).toBe(
      'surface:location:location_gate'
    );
    expect(studioLocationAssetsResourceKey('location_gate')).toBe(
      'assets:location:location_gate'
    );
    expect(studioLocationDesignResourceKey('location_gate')).toBe(
      'surface:locationDesign:location_gate'
    );
    expect(studioSceneNarrativeResourceKey('scene_gate')).toBe('scene:scene_gate');
    expect(studioSceneShotsResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:shots'
    );
    expect(studioSceneShotListResourceKey('shot_list_gate')).toBe(
      'scene-shot-list:shot_list_gate'
    );
    expect(studioSceneShotResourceKey('shot_list_gate', 'shot_arrival')).toBe(
      'scene-shot-list:shot_list_gate:shot:shot_arrival'
    );
  });

  it('builds accepted visual-language resource keys', () => {
    expect(studioVisualLanguageInspirationResourceKey()).toBe(
      'surface:visual-language:inspiration'
    );
    expect(
      studioVisualLanguageInspirationFolderResourceKey('inspiration_folder_palace')
    ).toBe('surface:visual-language:inspiration:inspiration_folder_palace');
    expect(studioVisualLanguageLookbooksResourceKey()).toBe(
      'surface:visual-language:lookbooks'
    );
    expect(studioVisualLanguageLookbookResourceKey('lookbook_noir')).toBe(
      'surface:visual-language:lookbook:lookbook_noir'
    );
  });
});
