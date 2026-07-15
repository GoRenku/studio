import type { PreviewImage } from '@/ui/image-preview-dialog';
import { imageAspectRatioFromDimensions } from '@/ui/image-aspect-ratio';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { castAssetFileUrl } from '@/services/studio-project-assets-api';

export const CAST_PROFILE_ROLE = 'profile';
export const CAST_CHARACTER_SHEET_ROLES = ['character-sheet'] as const;

export function castImageAssetsForRole(
  assets: StudioAssetResponse[],
  role: string
): StudioAssetResponse[] {
  return sortCastAssets(
    assets.filter(
      (asset) => asset.role === role && Boolean(castImageAssetFile(asset))
    )
  );
}

export function castImageAssetsForRoles(
  assets: StudioAssetResponse[],
  roles: readonly string[]
): StudioAssetResponse[] {
  const acceptedRoles = new Set(roles);
  return sortCastAssets(
    assets.filter(
      (asset) => acceptedRoles.has(asset.role) && Boolean(castImageAssetFile(asset))
    )
  );
}

export function castImageAssetFile(asset: StudioAssetResponse) {
  return asset.files.find((file) => file.mediaKind === 'image') ?? null;
}

export function castImageAssetUrl(
  projectName: string,
  castMemberId: string,
  asset: StudioAssetResponse
): string | null {
  const file = castImageAssetFile(asset);
  return file
    ? castAssetFileUrl(projectName, castMemberId, asset.assetId, file.id)
    : null;
}

export function castImageAssetAspectRatio(
  asset: StudioAssetResponse,
  fallbackAspectRatio: number
): number {
  const file = castImageAssetFile(asset);
  return imageAspectRatioFromDimensions(
    file?.width,
    file?.height,
    fallbackAspectRatio
  );
}

export function castPreviewImageForAsset(
  projectName: string,
  castMemberId: string,
  asset: StudioAssetResponse
): PreviewImage | null {
  const src = castImageAssetUrl(projectName, castMemberId, asset);
  if (!src) return null;
  return {
    src,
    alt: asset.title,
    title: readableCastImageTitle(asset),
  };
}

export function readableCastImageTitle(asset: StudioAssetResponse): string {
  const title = asset.title.trim();
  if (title) return humanizeAssetTitle(title);
  return humanizeAssetRole(asset.role);
}

export function humanizeAssetRole(role: string): string {
  return role
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function humanizeAssetTitle(title: string): string {
  const withoutExtension = title.replace(/\.[^.]+$/, '');
  const titleWithSpaces = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!titleWithSpaces) return title;
  if (titleWithSpaces.includes(' ')) {
    return titleWithSpaces.charAt(0).toUpperCase() + titleWithSpaces.slice(1);
  }
  return title;
}

function sortCastAssets(assets: StudioAssetResponse[]): StudioAssetResponse[] {
  return [...assets].sort((left, right) => {
    const sortDifference = left.sortOrder - right.sortOrder;
    if (sortDifference !== 0) return sortDifference;

    const titleDifference = left.title.localeCompare(right.title);
    if (titleDifference !== 0) return titleDifference;

    return left.assetId.localeCompare(right.assetId);
  });
}
