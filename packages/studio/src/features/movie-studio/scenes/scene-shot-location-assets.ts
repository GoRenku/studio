import type { LocationAzimuthViewId } from '@gorenku/studio-core/client';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import {
  locationEnvironmentSheetPreviewImages,
  preferredLocationEnvironmentSheetAsset,
} from '../locations/location-assets';

export interface ShotLocationRecord {
  id: string;
  name: string;
}

export interface ShotLocationViewImage {
  id: LocationAzimuthViewId;
  label: string;
  src: string | null;
  selectable: boolean;
}

export interface ShotLocationAssetProjection {
  location: ShotLocationRecord | null;
  sheetAsset: StudioAssetResponse | null;
  viewImages: ShotLocationViewImage[];
}

const VIEW_LABELS: Record<LocationAzimuthViewId, string> = {
  front: 'Front',
  right: 'Right',
  back: 'Back',
  left: 'Left',
};

const VIEW_TITLE_BY_ID: Record<LocationAzimuthViewId, string> = {
  front: 'Front view',
  right: 'Right view',
  back: 'Back view',
  left: 'Left view',
};

export function projectShotLocationAssets(input: {
  projectName: string;
  selectedLocationId: string | undefined;
  locationLabels: Record<string, string>;
  assets: StudioAssetResponse[];
}): ShotLocationAssetProjection {
  const location = input.selectedLocationId
    ? {
        id: input.selectedLocationId,
        name: input.locationLabels[input.selectedLocationId] ?? 'Location',
      }
    : null;
  const sheetAsset = preferredLocationEnvironmentSheetAsset(input.assets);
  const previews =
    location && sheetAsset
      ? locationEnvironmentSheetPreviewImages(
          input.projectName,
          location.id,
          sheetAsset
        )
      : [];

  return {
    location,
    sheetAsset,
    viewImages: (Object.keys(VIEW_LABELS) as LocationAzimuthViewId[]).map(
      (id) => {
        const image = findPreviewImage(previews, id);
        return {
          id,
          label: VIEW_LABELS[id],
          src: image?.src ?? null,
          selectable: Boolean(image?.src),
        };
      }
    ),
  };
}

function findPreviewImage(
  previews: PreviewImage[],
  viewId: LocationAzimuthViewId
): PreviewImage | null {
  return (
    previews.find((image) => image.title === VIEW_TITLE_BY_ID[viewId]) ?? null
  );
}
