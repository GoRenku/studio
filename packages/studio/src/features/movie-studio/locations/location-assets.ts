import type { PreviewImage } from '@/ui/image-preview-dialog';
import { imageAspectRatioFromDimensions } from '@/ui/image-aspect-ratio';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { locationAssetFileUrl } from '@/services/studio-project-assets-api';

export const LOCATION_SHEET_ROLES = ['environment_sheet', 'location-sheet'] as const;
export const LOCATION_SHEET_TYPES = ['location_environment_sheet', 'location-sheet'] as const;
export const LOCATION_HERO_ROLE = 'hero';
export const LOCATION_HERO_TYPE = 'location_hero';

export function locationSheetAssets(
  assets: StudioAssetResponse[]
): StudioAssetResponse[] {
  const roles = new Set<string>(LOCATION_SHEET_ROLES);
  const types = new Set<string>(LOCATION_SHEET_TYPES);
  return sortLocationAssets(
    assets.filter(
      (asset) =>
        types.has(asset.type) &&
        roles.has(asset.role) &&
        Boolean(primaryImageFile(asset))
    )
  );
}

export function locationHeroAssets(
  assets: StudioAssetResponse[]
): StudioAssetResponse[] {
  return sortLocationAssets(
    assets.filter(
      (asset) =>
        asset.type === LOCATION_HERO_TYPE &&
        asset.role === LOCATION_HERO_ROLE &&
        Boolean(primaryImageFile(asset))
    )
  );
}

export function currentLocationHeroAsset(
  assets: StudioAssetResponse[]
): StudioAssetResponse | null {
  const heroes = locationHeroAssets(assets);
  return (
    heroes.find((asset) => asset.selection.kind === 'select') ?? null
  );
}

export function primaryImageFile(asset: StudioAssetResponse) {
  return (
    asset.files.find(
      (file) => file.role === 'primary' && file.mediaKind === 'image'
    ) ?? null
  );
}

export function locationEnvironmentSheetCompositeUrl(
  projectName: string,
  locationId: string,
  asset: StudioAssetResponse
): string | null {
  const file = primaryImageFile(asset);
  return file
    ? locationAssetFileUrl(projectName, locationId, asset.assetId, file.id)
    : null;
}

export function locationEnvironmentSheetAspectRatio(
  asset: StudioAssetResponse,
  fallbackAspectRatio: number
): number {
  const file = primaryImageFile(asset);
  return imageAspectRatioFromDimensions(
    file?.width,
    file?.height,
    fallbackAspectRatio
  );
}

export function locationEnvironmentSheetPreviewImages(
  projectName: string,
  locationId: string,
  asset: StudioAssetResponse
): PreviewImage[] {
  const file = primaryImageFile(asset);
  if (!file) return [];
  return [
    {
      src: locationAssetFileUrl(projectName, locationId, asset.assetId, file.id),
      alt: readableLocationSheetTitle(asset),
      title: readableLocationSheetTitle(asset),
    },
  ];
}

export function readableLocationSheetTitle(asset: StudioAssetResponse): string {
  const title = asset.title.trim();
  return title ? humanizeAssetTitle(title) : 'Location Sheet';
}

function sortLocationAssets(
  assets: StudioAssetResponse[]
): StudioAssetResponse[] {
  return [...assets].sort((left, right) => {
    const selectionDifference = selectionRank(left) - selectionRank(right);
    if (selectionDifference !== 0) return selectionDifference;

    const selectionOrderDifference =
      selectionOrderRank(left) - selectionOrderRank(right);
    if (selectionOrderDifference !== 0) return selectionOrderDifference;

    const sortDifference = left.sortOrder - right.sortOrder;
    if (sortDifference !== 0) return sortDifference;

    const titleDifference = left.title.localeCompare(right.title);
    if (titleDifference !== 0) return titleDifference;

    return left.assetId.localeCompare(right.assetId);
  });
}

function selectionRank(asset: StudioAssetResponse): number {
  return asset.selection.kind === 'select' ? 0 : 1;
}

function selectionOrderRank(asset: StudioAssetResponse): number {
  return asset.selection.kind === 'select'
    ? asset.selection.order
    : Number.MAX_SAFE_INTEGER;
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
