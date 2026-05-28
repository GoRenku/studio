import { useState } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { ImageCardGrid } from '@/ui/image-card-grid';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
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

  return (
    <>
      <div className='min-h-full overflow-y-auto bg-panel-bg p-5 sm:p-8 lg:p-10'>
        <div className='mx-auto max-w-[1240px] space-y-10'>
          <section className='space-y-4'>
            <div className='flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-4'>
              <div className='min-w-0'>
                <h2 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                  Location Sheets
                </h2>
              </div>
              <span className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/70'>
                {sheetAssets.length === 1
                  ? '1 image'
                  : `${sheetAssets.length} images`}
              </span>
            </div>
            {sheetAssets.length ? (
              <ImageCardGrid className='grid-cols-[repeat(auto-fill,minmax(480px,1fr))]'>
                {sheetAssets.map((asset) => {
                  const selected = asset.selection.kind === 'select';
                  return (
                    <ImageOverlayCard
                      key={asset.assetId}
                      imageUrl={locationEnvironmentSheetCompositeUrl(
                        projectName,
                        locationId,
                        asset
                      )}
                      imageAlt={selected ? 'Active location sheet' : 'Location sheet'}
                      aspectClassName='aspect-[4/3]'
                      aspectRatio={locationEnvironmentSheetAspectRatio(
                        asset,
                        4 / 3
                      )}
                      detectImageAspectRatio
                      imageClassName='object-contain'
                      selected={selected}
                      onOpen={() => openSheetPreview(asset)}
                      bottomRightControl={
                        <ImageSelectionControl
                          selected={selected}
                          selectedLabel='Clear active location sheet'
                          unselectedLabel='Set active location sheet'
                          onToggleSelected={() => onToggleActive(asset)}
                        />
                      }
                      topRightAction={
                        <DeleteConfirmDialog
                          title='Delete Location Sheet?'
                          message='Remove this location sheet from this location. This cannot be undone.'
                          onDelete={async () => {
                            await onDeleteAsset(asset);
                            setPreviewImages((current) =>
                              current.some((image) =>
                                image.src.includes(
                                  encodeURIComponent(asset.assetId)
                                )
                              )
                                ? []
                                : current
                            );
                          }}
                          trigger={
                            <Button
                              type='button'
                              size='icon'
                              variant='ghost'
                              className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
                              aria-label='Delete location sheet'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          }
                        />
                      }
                    />
                  );
                })}
              </ImageCardGrid>
            ) : (
              <LocationSheetEmptyState />
            )}
          </section>
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

function LocationSheetEmptyState() {
  return (
    <div className='flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 p-6 text-center'>
      <ImageOff className='mb-3 h-5 w-5 text-muted-foreground' />
      <p className='text-sm font-medium text-foreground'>
        No location sheets yet.
      </p>
    </div>
  );
}
