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
    case 'continuityReference':
      return `assets:continuityReference:${target.continuityReferenceId}`;
    case 'sequence':
      return `assets:sequence:${target.sequenceId}`;
    case 'scene':
      return `assets:scene:${target.sceneId}`;
    case 'clip':
      return `assets:clip:${target.clipId}`;
  }
}

export function studioSurfaceResourceKeyForAssetTarget(
  target: AssetTarget
): string | null {
  switch (target.kind) {
    case 'castMember':
      return `surface:cast-design:${target.castMemberId}`;
    case 'clip':
      return `surface:clip-design:${target.clipId}`;
    case 'project':
    case 'visualLanguage':
    case 'continuityReference':
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

export function studioMarkdownResourceKey(input: {
  assetId: string;
  assetFileId: string;
}): string {
  return `markdown:${input.assetId}:${input.assetFileId}`;
}
