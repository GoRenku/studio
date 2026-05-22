import type { AssetTarget } from '../../client/index.js';

export function studioProjectShellResourceKey(): string {
  return 'project-shell';
}

export function studioProjectInformationResourceKey(): string {
  return 'project-information';
}

export function studioAssetResourceKey(target: AssetTarget): string {
  switch (target.kind) {
    case 'project':
      return 'assets:project';
    case 'visualLanguage':
      return `assets:visualLanguage:${target.visualLanguageId}`;
    case 'castMember':
      return `assets:castMember:${target.castMemberId}`;
    case 'location':
      return `assets:location:${target.locationId}`;
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
      return `surface:castMember:${target.castMemberId}`;
    case 'location':
      return `surface:location:${target.locationId}`;
    case 'project':
    case 'visualLanguage':
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
