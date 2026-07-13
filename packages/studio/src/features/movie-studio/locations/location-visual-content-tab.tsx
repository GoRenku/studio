import { useState } from 'react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { ImageCollectionSection } from '@/ui/image-collection-section';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  locationEnvironmentSheetAspectRatio,
  locationSheetAssets,
  locationEnvironmentSheetCompositeUrl,
  locationEnvironmentSheetPreviewImages,
} from './location-assets';
import { ImageRevisionCardAction } from '@/features/image-revision/image-revision-card-action';
import { useImageRevisionDialog } from '@/features/image-revision/use-image-revision-dialog';

interface LocationVisualContentTabProps {
  projectName: string;
  locationId: string;
  assets: StudioAssetResponse[];
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  locationId,
  assets,
  onDeleteAsset,
}: LocationVisualContentTabProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const { openImageRevision } = useImageRevisionDialog();
  const sheetAssets = locationSheetAssets(assets);

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
    return {
      id: asset.assetId,
      imageUrl: locationEnvironmentSheetCompositeUrl(projectName, locationId, asset),
      imageAlt: asset.oneLineSummary ?? 'Location sheet',
      description: asset.oneLineSummary ?? undefined,
      aspectClassName: 'aspect-[4/3]',
      aspectRatio: locationEnvironmentSheetAspectRatio(asset, 4 / 3),
      detectImageAspectRatio: true,
      imageClassName: 'object-contain',
      onOpen: () => openSheetPreview(asset),
      bottomRightActions: (
        <ImageRevisionCardAction
          onEdit={() => {
            const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
            if (!file) return;
            openImageRevision({
              projectName,
              target: {
                kind: 'locationEnvironmentSheet',
                locationId,
                assetId: asset.assetId,
                assetFileId: file.id,
              },
            });
          }}
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
