import { describe, expect, it } from 'vitest';
import {
  studioAssetTargetSurfaceResourceKeys,
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
  studioLocationNavigationResourceKey,
  studioLocationSurfaceResourceKey,
  studioProjectInformationResourceKey,
  studioProjectLibraryResourceKey,
  studioProjectShellResourceKey,
  studioSceneNarrativeResourceKey,
  studioSceneBeatSheetResourceKey,
  studioBeatResourceKey,
  studioSceneBeatsResourceKey,
  studioSceneDialogueAudioSurfaceResourceKey,
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

  it('builds accepted surface resource keys', () => {
    expect(studioCastMemberSurfaceResourceKey('cast_urban')).toBe(
      'surface:castMember:cast_urban'
    );
    expect(studioLocationSurfaceResourceKey('location_gate')).toBe(
      'surface:location:location_gate'
    );
    expect(studioSceneNarrativeResourceKey('scene_gate')).toBe('scene:scene_gate');
    expect(studioSceneShotsResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:shots'
    );
    expect(studioSceneBeatsResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:beats'
    );
    expect(studioSceneDialogueAudioSurfaceResourceKey('scene_gate')).toBe(
      'surface:scene:scene_gate:dialogue-audio'
    );
    expect(studioSceneBeatSheetResourceKey('beat_sheet_gate')).toBe(
      'scene-beat-sheet:beat_sheet_gate'
    );
    expect(studioBeatResourceKey('beat_sheet_gate', 'beat_arrival')).toBe(
      'scene-beat-sheet:beat_sheet_gate:beat:beat_arrival'
    );
  });

  it('maps Asset owners only to current owner surfaces', () => {
    expect(
      studioAssetTargetSurfaceResourceKeys({
        kind: 'castMember',
        castMemberId: 'cast_urban',
      })
    ).toEqual(['surface:castMember:cast_urban']);
    expect(
      studioAssetTargetSurfaceResourceKeys({
        kind: 'location',
        locationId: 'location_gate',
      })
    ).toEqual(['surface:location:location_gate']);
    expect(studioAssetTargetSurfaceResourceKeys({ kind: 'project' })).toEqual([]);
    expect(
      studioAssetTargetSurfaceResourceKeys({ kind: 'sequence', sequenceId: 'seq_1' })
    ).toEqual([]);
    expect(
      studioAssetTargetSurfaceResourceKeys({ kind: 'scene', sceneId: 'scene_1' })
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
