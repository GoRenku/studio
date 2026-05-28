import type { PreviewImage } from '@/ui/image-preview-dialog';
import { imageAspectRatioFromDimensions } from '@/ui/image-aspect-ratio';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { locationAssetFileUrl } from '@/services/studio-project-assets-api';

export const LOCATION_ENVIRONMENT_SHEET_ROLE = 'environment_sheet';
export const LOCATION_ENVIRONMENT_SHEET_TYPE = 'location_environment_sheet';

export const LOCATION_ENVIRONMENT_SHEET_FILE_ROLES = [
  'composite',
  'view_front',
  'view_right',
  'view_back',
  'view_left',
] as const;

type LocationEnvironmentSheetFileRole =
  (typeof LOCATION_ENVIRONMENT_SHEET_FILE_ROLES)[number];

const PREVIEW_FILE_LABELS: Record<LocationEnvironmentSheetFileRole, string> = {
  composite: 'Location sheet',
  view_front: 'Front view',
  view_right: 'Right view',
  view_back: 'Back view',
  view_left: 'Left view',
};

export function locationEnvironmentSheetAssets(
  assets: StudioAssetResponse[]
): StudioAssetResponse[] {
  return sortLocationAssets(
    assets.filter(
      (asset) =>
        asset.type === LOCATION_ENVIRONMENT_SHEET_TYPE &&
        asset.role === LOCATION_ENVIRONMENT_SHEET_ROLE &&
        Boolean(locationEnvironmentSheetFile(asset, 'composite'))
    )
  );
}

export function selectedLocationEnvironmentSheetAsset(
  assets: StudioAssetResponse[]
): StudioAssetResponse | null {
  return (
    locationEnvironmentSheetAssets(assets).find(
      (asset) => asset.selection.kind === 'select'
    ) ?? null
  );
}

export function preferredLocationEnvironmentSheetAsset(
  assets: StudioAssetResponse[]
): StudioAssetResponse | null {
  const sheets = locationEnvironmentSheetAssets(assets);
  return (
    sheets.find((asset) => asset.selection.kind === 'select') ??
    sheets[0] ??
    null
  );
}

export function locationEnvironmentSheetFile(
  asset: StudioAssetResponse,
  role: LocationEnvironmentSheetFileRole
) {
  return (
    asset.files.find(
      (file) => file.role === role && file.mediaKind === 'image'
    ) ?? null
  );
}

export function locationEnvironmentSheetCompositeUrl(
  projectName: string,
  locationId: string,
  asset: StudioAssetResponse
): string | null {
  const file = locationEnvironmentSheetFile(asset, 'composite');
  return file
    ? locationAssetFileUrl(projectName, locationId, asset.assetId, file.id)
    : null;
}

export function locationEnvironmentSheetAspectRatio(
  asset: StudioAssetResponse,
  fallbackAspectRatio: number
): number {
  const file = locationEnvironmentSheetFile(asset, 'composite');
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
  return LOCATION_ENVIRONMENT_SHEET_FILE_ROLES.flatMap((role) => {
    const file = locationEnvironmentSheetFile(asset, role);
    if (!file) return [];
    return {
      src: locationAssetFileUrl(projectName, locationId, asset.assetId, file.id),
      alt: `${readableLocationSheetTitle(asset)} ${PREVIEW_FILE_LABELS[role]}`,
      title:
        role === 'composite'
          ? readableLocationSheetTitle(asset)
          : PREVIEW_FILE_LABELS[role],
    };
  });
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
