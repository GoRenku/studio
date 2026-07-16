import { useState } from 'react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  locationEnvironmentSheetAspectRatio,
  locationSheetAssets,
  locationEnvironmentSheetCompositeUrl,
  locationEnvironmentSheetPreviewImages,
  locationHeroAssets,
} from './location-assets';
import { useImageRevisionDialog } from '@/features/image-revision/use-image-revision-dialog';

interface LocationVisualContentTabProps {
  projectName: string;
  locationId: string;
  assets: StudioAssetResponse[];
  displayHeroAssetId: string | null;
  onToggleHeroDisplay: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  locationId,
  assets,
  displayHeroAssetId,
  onToggleHeroDisplay,
  onDeleteAsset,
}: LocationVisualContentTabProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const { openImageRevision } = useImageRevisionDialog();
  const sheetAssets = locationSheetAssets(assets);
  const heroAssets = locationHeroAssets(assets);

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
    const imageUrl = locationEnvironmentSheetCompositeUrl(
      projectName,
      locationId,
      asset
    );
    return {
      id: asset.assetId,
      card: {
        media: imageUrl
          ? {
              kind: 'image' as const,
              src: imageUrl,
              alt: asset.oneLineSummary ?? 'Location sheet',
              fit: 'contain' as const,
              effect: 'zoom-on-hover' as const,
            }
          : null,
        frame: {
          kind: 'ratio' as const,
          aspectRatio: locationEnvironmentSheetAspectRatio(asset, 4 / 3),
          detectFromImage: true,
        },
        presentation: {
          kind: 'overlay' as const,
          copy: asset.oneLineSummary
            ? { description: asset.oneLineSummary }
            : undefined,
        },
        activation: {
          label: asset.oneLineSummary ?? 'Location sheet',
          onActivate: () => openSheetPreview(asset),
        },
        editAction: {
          label: 'Edit image',
          onEdit: () => {
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
          },
        },
        deleteAction: {
          label: 'Delete location sheet',
          confirmationTitle: 'Delete Location Sheet?',
          confirmationMessage:
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
        emptyState: { kind: 'image' as const },
      },
    };
  });
  const heroItems = heroAssets.map((asset) => {
    const selected = asset.assetId === displayHeroAssetId;
    const imageUrl = locationEnvironmentSheetCompositeUrl(
      projectName,
      locationId,
      asset
    );
    return {
      id: asset.assetId,
      card: {
        media: imageUrl
          ? {
              kind: 'image' as const,
              src: imageUrl,
              alt: selected ? 'Current location hero' : 'Location hero',
              fit: 'cover' as const,
              effect: 'zoom-on-hover' as const,
            }
          : null,
        frame: {
          kind: 'ratio' as const,
          aspectRatio: locationEnvironmentSheetAspectRatio(asset, 16 / 9),
          detectFromImage: true,
        },
        presentation: { kind: 'overlay' as const },
        activation: {
          label: selected ? 'Current location hero' : 'Location hero',
          onActivate: () => openSheetPreview(asset),
        },
        selection: {
          selected,
          selectedLabel: 'Clear location hero display',
          unselectedLabel: 'Use as location hero display',
          onToggle: () => onToggleHeroDisplay(asset),
        },
        deleteAction: {
          label: 'Delete location hero',
          confirmationTitle: 'Delete Location Hero?',
          confirmationMessage:
            'Remove this hero image from this location. This cannot be undone.',
          onDelete: () => onDeleteAsset(asset),
        },
        emptyState: { kind: 'image' as const },
      },
    };
  });

  return (
    <>
      <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
        <div className='space-y-8'>
          <MediaCollectionSection
            title='Hero Images'
            emptyTitle='No hero images yet.'
            items={heroItems}
            minimumCardWidthPx={320}
          />
          <MediaCollectionSection
            title='Location Sheets'
            emptyTitle='No location sheets yet.'
            items={items}
            minimumCardWidthPx={480}
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
