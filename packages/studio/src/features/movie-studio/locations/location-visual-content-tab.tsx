import { useState } from 'react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { ImageCollectionSection } from '@/ui/image-collection-section';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  locationEnvironmentSheetAspectRatio,
  locationEnvironmentSheetAssets,
  locationEnvironmentSheetCompositeUrl,
  locationEnvironmentSheetPreviewImages,
} from './location-assets';

interface LocationVisualContentTabProps {
  projectName: string;
  locationId: string;
  assets: StudioAssetResponse[];
  onToggleActive: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  locationId,
  assets,
  onToggleActive,
  onDeleteAsset,
}: LocationVisualContentTabProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const sheetAssets = locationEnvironmentSheetAssets(assets);

  const openSheetPreview = (asset: StudioAssetResponse) => {
    const images = locationEnvironmentSheetPreviewImages(
      projectName,
      locationId,
      asset
    );
    if (!images.length) return;
    setPreviewImages(images);
    setPreviewIndex(0);
  };

  const items = sheetAssets.map((asset) => {
    const selected = asset.selection.kind === 'select';
    return {
      id: asset.assetId,
      imageUrl: locationEnvironmentSheetCompositeUrl(projectName, locationId, asset),
      imageAlt: selected ? 'Active location sheet' : 'Location sheet',
      aspectClassName: 'aspect-[4/3]',
      aspectRatio: locationEnvironmentSheetAspectRatio(asset, 4 / 3),
      detectImageAspectRatio: true,
      imageClassName: 'object-contain',
      selected,
      onOpen: () => openSheetPreview(asset),
      bottomRightControl: (
        <ImageSelectionControl
          selected={selected}
          selectedLabel='Clear active location sheet'
          unselectedLabel='Set active location sheet'
          onToggleSelected={() => onToggleActive(asset)}
        />
      ),
      deleteAction: {
        label: 'Delete location sheet',
        title: 'Delete Location Sheet?',
        message:
          'Remove this location sheet from this location. This cannot be undone.',
        onDelete: async () => {
          await onDeleteAsset(asset);
          setPreviewImages((current) =>
            current.some((image) =>
              image.src.includes(encodeURIComponent(asset.assetId))
            )
              ? []
              : current
          );
        },
      },
    };
  });

  return (
    <>
      <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
        <div className='space-y-8'>
          <ImageCollectionSection
            title='Location Sheets'
            emptyTitle='No location sheets yet.'
            items={items}
            gridClassName='grid-cols-[repeat(auto-fill,minmax(480px,1fr))]'
          />
        </div>
      </div>
      <ImagePreviewDialog
        images={previewImages}
        currentIndex={previewIndex}
        onCurrentIndexChange={setPreviewIndex}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImages([]);
            setPreviewIndex(0);
          }
        }}
      />
    </>
  );
}
