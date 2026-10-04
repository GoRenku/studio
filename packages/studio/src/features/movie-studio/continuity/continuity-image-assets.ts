import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';
import { imageAspectRatioFromDimensions } from '@/ui/image-aspect-ratio';
import type { PreviewImage } from '@/ui/image-preview-dialog';

export function continuityImageAssetFiles(
  assetFiles: StudioAssetFileResponse[],
  acceptedTypes: readonly string[]
): StudioAssetFileResponse[] {
  const types = new Set<string>(acceptedTypes);
  return sortContinuityImageAssetFiles(
    assetFiles.filter(
      (assetFile) => types.has(assetFile.type) && Boolean(continuityPrimaryImageFile(assetFile))
    )
  );
}

export function continuityPrimaryImageFile(assetFile: StudioAssetFileResponse) {
  return assetFile.mediaKind === 'image' ? assetFile : null;
}

export function continuityImageUrl(
  projectName: string,
  assetFile: StudioAssetFileResponse
): string | null {
  const file = continuityPrimaryImageFile(assetFile);
  return file ? projectAssetFileUrl(projectName, file.id) : null;
}

export function continuityImageAspectRatio(
  assetFile: StudioAssetFileResponse,
  fallbackAspectRatio: number
): number {
  const file = continuityPrimaryImageFile(assetFile);
  return imageAspectRatioFromDimensions(
    file?.width,
    file?.height,
    fallbackAspectRatio
  );
}

export function continuityPreviewImage(
  projectName: string,
  assetFile: StudioAssetFileResponse,
  fallbackTitle: string
): PreviewImage | null {
  const file = continuityPrimaryImageFile(assetFile);
  if (!file) return null;
  const title = readableContinuityImageTitle(assetFile, fallbackTitle);
  return {
    src: projectAssetFileUrl(projectName, file.id),
    alt: title,
    title,
  };
}

export function readableContinuityImageTitle(
  assetFile: StudioAssetFileResponse,
  fallbackTitle: string
): string {
  const title = (assetFile.title ?? '').trim();
  if (!title) return fallbackTitle;
  const withoutExtension = title.replace(/\.[^.]+$/, '');
  const titleWithSpaces = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!titleWithSpaces) return title;
  return titleWithSpaces.charAt(0).toUpperCase() + titleWithSpaces.slice(1);
}

function sortContinuityImageAssetFiles(
  assetFiles: StudioAssetFileResponse[]
): StudioAssetFileResponse[] {
  return [...assetFiles].sort((left, right) => {
    const createdDifference = right.createdAt.localeCompare(left.createdAt);
    if (createdDifference !== 0) return createdDifference;
    const titleDifference = (left.title ?? '').localeCompare(right.title ?? '');
    return titleDifference !== 0 ? titleDifference : left.id.localeCompare(right.id);
  });
}
