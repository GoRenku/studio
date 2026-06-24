import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { ImageCollectionSection } from '@/ui/image-collection-section';
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
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
  onGenerateHero: (asset: StudioAssetResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  locationId,
  assets,
  onDeleteAsset,
  onGenerateHero,
}: LocationVisualContentTabProps) {
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [generatingHeroAssetId, setGeneratingHeroAssetId] = useState<string | null>(
    null
  );
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
      bottomRightControl: (
        <Button
          type='button'
          size='icon'
          variant='secondary'
          className='h-8 w-8 bg-white/90 text-foreground shadow-sm hover:bg-white'
          aria-label='Generate hero image from this sheet'
          disabled={generatingHeroAssetId !== null}
          onClick={async () => {
            setGeneratingHeroAssetId(asset.assetId);
            try {
              await onGenerateHero(asset);
            } finally {
              setGeneratingHeroAssetId(null);
            }
          }}
        >
          <Sparkles className='h-4 w-4' />
        </Button>
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
