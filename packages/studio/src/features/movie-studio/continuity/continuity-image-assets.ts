import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';
import { imageAspectRatioFromDimensions } from '@/ui/image-aspect-ratio';
import type { PreviewImage } from '@/ui/image-preview-dialog';

export function continuityImageAssets(
  assets: StudioAssetResponse[],
  acceptedTypes: readonly string[]
): StudioAssetResponse[] {
  const types = new Set<string>(acceptedTypes);
  return sortContinuityImageAssets(
    assets.filter(
      (asset) => types.has(asset.type) && Boolean(continuityPrimaryImageFile(asset))
    )
  );
}

export function continuityPrimaryImageFile(asset: StudioAssetResponse) {
  return (
    asset.files.find(
      (file) => file.role === 'primary' && file.mediaKind === 'image'
    ) ??
    asset.files.find((file) => file.mediaKind === 'image') ??
    null
  );
}

export function continuityImageUrl(
  projectName: string,
  asset: StudioAssetResponse
): string | null {
  const file = continuityPrimaryImageFile(asset);
  return file ? projectAssetFileUrl(projectName, asset.id, file.id) : null;
}

export function continuityImageAspectRatio(
  asset: StudioAssetResponse,
  fallbackAspectRatio: number
): number {
  const file = continuityPrimaryImageFile(asset);
  return imageAspectRatioFromDimensions(
    file?.width,
    file?.height,
    fallbackAspectRatio
  );
}

export function continuityPreviewImage(
  projectName: string,
  asset: StudioAssetResponse,
  fallbackTitle: string
): PreviewImage | null {
  const file = continuityPrimaryImageFile(asset);
  if (!file) return null;
  const title = readableContinuityImageTitle(asset, fallbackTitle);
  return {
    src: projectAssetFileUrl(projectName, asset.id, file.id),
    alt: title,
    title,
  };
}

export function readableContinuityImageTitle(
  asset: StudioAssetResponse,
  fallbackTitle: string
): string {
  const title = asset.title.trim();
  if (!title) return fallbackTitle;
  const withoutExtension = title.replace(/\.[^.]+$/, '');
  const titleWithSpaces = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!titleWithSpaces) return title;
  return titleWithSpaces.charAt(0).toUpperCase() + titleWithSpaces.slice(1);
}

function sortContinuityImageAssets(
  assets: StudioAssetResponse[]
): StudioAssetResponse[] {
  return [...assets].sort((left, right) => {
    const createdDifference = right.createdAt.localeCompare(left.createdAt);
    if (createdDifference !== 0) return createdDifference;
    const titleDifference = left.title.localeCompare(right.title);
    return titleDifference !== 0 ? titleDifference : left.id.localeCompare(right.id);
  });
}
