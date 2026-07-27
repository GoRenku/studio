import type { AssetOwner } from '../../client/index.js';

export function studioProjectShellResourceKey(): string {
  return 'project-shell';
}

export function studioProjectLibraryResourceKey(): string {
  return 'project-library';
}

export function studioProjectInformationResourceKey(): string {
  return 'project-information';
}

export function studioTrashResourceKey(): string {
  return 'trash:list';
}

export function studioCastNavigationResourceKey(): string {
  return 'navigation:cast';
}

export function studioCastMemberSurfaceResourceKey(castMemberId: string): string {
  return `surface:castMember:${castMemberId}`;
}

export function studioLocationNavigationResourceKey(): string {
  return 'navigation:locations';
}

export function studioLocationSurfaceResourceKey(locationId: string): string {
  return `surface:location:${locationId}`;
}

export function studioVisualLanguageInspirationResourceKey(): string {
  return 'surface:visual-language:inspiration';
}

export function studioVisualLanguageInspirationFolderResourceKey(
  folderId: string
): string {
  return `surface:visual-language:inspiration:${folderId}`;
}

export function studioVisualLanguageLookbooksResourceKey(): string {
  return 'surface:visual-language:lookbooks';
}

export function studioVisualLanguageLookbookResourceKey(lookbookId: string): string {
  return `surface:visual-language:lookbook:${lookbookId}`;
}

export function studioStoryArcSurfaceResourceKey(): string {
  return 'surface:story-arc';
}

export function studioScreenplayResourceKey(): string {
  return 'screenplay';
}

export function studioScreenplayActsResourceKey(): string {
  return 'screenplay:acts';
}

export function studioActSurfaceResourceKey(actId: string): string {
  return `surface:act:${actId}`;
}

export function studioSequenceSurfaceResourceKey(sequenceId: string): string {
  return `surface:sequence:${sequenceId}`;
}

export function studioSequenceScenesNavigationResourceKey(
  sequenceId: string
): string {
  return `navigation:sequence-scenes:${sequenceId}`;
}

export function studioSceneNarrativeResourceKey(sceneId: string): string {
  return `scene:${sceneId}`;
}

export function studioSceneShotPlansResourceKey(sceneId: string): string {
  return `surface:scene:${sceneId}:shot-plans`;
}

export function studioSceneBeatsResourceKey(sceneId: string): string {
  return `surface:scene:${sceneId}:beats`;
}

export function studioSceneDialogueAudioSurfaceResourceKey(sceneId: string): string {
  return `surface:scene:${sceneId}:dialogue-audio`;
}

export function studioSceneBeatSheetResourceKey(beatSheetId: string): string {
  return `scene-beat-sheet:${beatSheetId}`;
}

export function studioBeatResourceKey(
  beatSheetId: string,
  beatId: string
): string {
  return `scene-beat-sheet:${beatSheetId}:beat:${beatId}`;
}

export function studioAssetOwnerSurfaceResourceKeys(owner: AssetOwner): string[] {
  switch (owner.kind) {
    case 'castMember':
      return [studioCastMemberSurfaceResourceKey(owner.id)];
    case 'location':
      return [studioLocationSurfaceResourceKey(owner.id)];
    case 'lookbook':
      return [studioVisualLanguageLookbookResourceKey(owner.id)];
    case 'sceneBeat':
      return [studioSceneBeatsResourceKey(owner.sceneId)];
    case 'shot':
      return [];
    case 'project':
    case 'sequence':
    case 'scene':
      return [];
  }
}
