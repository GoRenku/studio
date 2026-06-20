import type { AssetTarget } from '../../client/index.js';

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

export function studioCastMemberAssetsResourceKey(castMemberId: string): string {
  return `assets:castMember:${castMemberId}`;
}

export function studioCastDesignResourceKey(castMemberId: string): string {
  return `surface:castDesign:${castMemberId}`;
}

export function studioLocationNavigationResourceKey(): string {
  return 'navigation:locations';
}

export function studioLocationSurfaceResourceKey(locationId: string): string {
  return `surface:location:${locationId}`;
}

export function studioLocationAssetsResourceKey(locationId: string): string {
  return `assets:location:${locationId}`;
}

export function studioLocationDesignResourceKey(locationId: string): string {
  return `surface:locationDesign:${locationId}`;
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

export function studioSceneShotsResourceKey(sceneId: string): string {
  return `surface:scene:${sceneId}:shots`;
}

export function studioSceneShotListResourceKey(shotListId: string): string {
  return `scene-shot-list:${shotListId}`;
}

export function studioSceneShotResourceKey(
  shotListId: string,
  shotId: string
): string {
  return `scene-shot-list:${shotListId}:shot:${shotId}`;
}

export function studioShotVideoTakeGroupResourceKey(groupId: string): string {
  return `scene-shot-video-take-group:${groupId}`;
}

export function studioShotVideoTakeInputResourceKey(inputId: string): string {
  return `scene-shot-video-take-input:${inputId}`;
}

export function studioAssetResourceKey(target: AssetTarget): string {
  switch (target.kind) {
    case 'project':
      return 'assets:project';
    case 'castMember':
      return studioCastMemberAssetsResourceKey(target.castMemberId);
    case 'location':
      return studioLocationAssetsResourceKey(target.locationId);
    case 'sequence':
      return `assets:sequence:${target.sequenceId}`;
    case 'scene':
      return `assets:scene:${target.sceneId}`;
  }
}

export function studioSurfaceResourceKeyForAssetTarget(
  target: AssetTarget
): string | null {
  switch (target.kind) {
    case 'castMember':
      return studioCastMemberSurfaceResourceKey(target.castMemberId);
    case 'location':
      return studioLocationSurfaceResourceKey(target.locationId);
    case 'project':
    case 'sequence':
    case 'scene':
      return null;
  }
}

export function studioResourceKeysForAssetTarget(target: AssetTarget): string[] {
  return [
    studioAssetResourceKey(target),
    studioSurfaceResourceKeyForAssetTarget(target),
  ].filter((key): key is string => key !== null);
}
