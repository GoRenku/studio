import type { ScreenplayImageReference } from '@gorenku/studio-core/client';
import { sceneAssetFileUrl } from '@/services/studio-project-assets-api';

// Builds the HTTP URL for a storyboard sheet or sliced shot image attached to a
// Scene target, exactly as `location-assets.ts` does for location sheets. The
// reference's `assetId`/`assetFileId` come from the relationship tables, never
// from filenames (ADR 0024).
export function storyboardImageUrl(
  projectName: string,
  sceneId: string,
  image: ScreenplayImageReference
): string {
  return sceneAssetFileUrl(
    projectName,
    sceneId,
    image.assetId,
    image.assetFileId
  );
}
