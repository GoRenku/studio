import { describe, expect, it } from 'vitest';
import {
  studioAssetOwnerSurfaceResourceKeys,
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
  studioLocationNavigationResourceKey,
  studioLocationSurfaceResourceKey,
  studioProjectInformationResourceKey,
  studioProjectLibraryResourceKey,
  studioProjectShellResourceKey,
  studioSceneNarrativeResourceKey,
  studioSceneBeatsResourceKey,
  studioBeatResourceKey,
  studioSceneBeatsRevisionResourceKey,
  studioSceneDialogueAudioSurfaceResourceKey,
  studioSceneShotPlansResourceKey,
  studioScreenplayResourceKey,
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
  });

  it('builds accepted surface resource keys', () => {
    expect(studioCastMemberSurfaceResourceKey('cast_urban')).toBe(
      'surface:castMember:cast_urban'
    );
    expect(studioLocationSurfaceResourceKey('location_gate')).toBe(
      'surface:location:location_gate'
    );
    expect(studioSceneNarrativeResourceKey('scene_gate')).toBe('scene:scene_gate');
    expect(studioSceneShotPlansResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:shot-plans'
    );
    expect(studioSceneBeatsResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:beats'
    );
    expect(studioSceneDialogueAudioSurfaceResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:dialogue-audio'
    );
    expect(studioSceneBeatsRevisionResourceKey('scene_beats_revision_gate')).toBe(
      'scene-beats-revision:scene_beats_revision_gate'
    );
    expect(studioBeatResourceKey('scene_beats_revision_gate', 'beat_arrival')).toBe(
      'scene-beats:scene_beats_revision_gate:beat:beat_arrival'
    );
  });

  it('maps Asset owners only to current owner surfaces', () => {
    expect(
      studioAssetOwnerSurfaceResourceKeys({
        kind: 'castMember',
        id: 'cast_urban',
      })
    ).toEqual(['surface:castMember:cast_urban']);
    expect(
      studioAssetOwnerSurfaceResourceKeys({
        kind: 'location',
        id: 'location_gate',
      })
    ).toEqual(['surface:location:location_gate']);
    expect(studioAssetOwnerSurfaceResourceKeys({ kind: 'project' })).toEqual([]);
    expect(
      studioAssetOwnerSurfaceResourceKeys({ kind: 'scene', id: 'scene_1' })
    ).toEqual([]);
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
