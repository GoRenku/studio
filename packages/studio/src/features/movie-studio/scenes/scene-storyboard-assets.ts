import type { ScreenplayImageReference } from '@gorenku/studio-core/client';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';

// Builds the owner-independent HTTP URL for one selected Scene Beat Storyboard
// AssetFile. The ids come from the Core projection, never from filenames.
export function storyboardImageUrl(
  projectName: string,
  image: ScreenplayImageReference
): string {
  return projectAssetFileUrl(
    projectName,
    image.assetId,
    image.assetFileId
  );
}
