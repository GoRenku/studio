import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  LocationResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { useImageAspectRatio } from '@/ui/image-aspect-ratio';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { cn } from '@/lib/utils';
import {
  locationEnvironmentSheetAspectRatio,
  locationEnvironmentSheetPreviewImages,
} from './location-assets';

interface LocationDetailsTabProps {
  projectName: string;
  locationId: string;
  resource: LocationResourceResponse;
  assets: StudioAssetResponse[];
}

export function LocationDetailsTab({
  projectName,
  locationId,
  resource,
  assets,
}: LocationDetailsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const location = resource.location;
  const heroAsset = assets.find(
    (asset) => asset.assetId === resource.firstImage?.assetId
  ) ?? null;
  const heroPreview = heroAsset
    ? locationEnvironmentSheetPreviewImages(projectName, locationId, heroAsset)[0] ??
      null
    : null;
  const heroAspectRatio = heroAsset
    ? locationEnvironmentSheetAspectRatio(heroAsset, 16 / 9)
    : 16 / 9;

  return (
    <>
      <article className='min-h-full bg-panel-bg px-4 py-5 text-foreground'>
        <header className='grid gap-6 pb-8 lg:grid-cols-[minmax(260px,390px)_minmax(0,1fr)] lg:gap-8'>
          <LocationFeatureImage
            image={heroPreview}
            aspectRatio={heroAspectRatio}
            emptyLabel='No location hero image yet'
            onOpenImage={setPreviewImage}
          />
          <div className='flex min-w-0 flex-col justify-end'>
            <div className='flex flex-wrap items-center gap-2'>
              {location.timePeriod ? (
                <span className='rounded-full border border-border/50 bg-muted/45 px-3 py-1 text-xs font-semibold text-foreground/75'>
                  {location.timePeriod}
                </span>
              ) : null}
            </div>
            <h1 className='mt-4 max-w-[920px] text-4xl font-black leading-none text-foreground sm:text-5xl lg:text-6xl'>
              {location.name}
            </h1>
            {location.description ? (
              <p className='mt-6 max-w-[780px] whitespace-pre-wrap text-base font-semibold leading-8 text-foreground/82 lg:text-lg'>
                {location.description}
              </p>
            ) : null}
            {location.visualNotes ? (
              <dl className='mt-7 grid gap-3 sm:grid-cols-2'>
                <div className='border-t border-border/40 pt-4'>
                  <dt className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                    Visual Notes
                  </dt>
                  <dd className='mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/78'>
                    {location.visualNotes}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </header>
      </article>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function LocationFeatureImage({
  image,
  aspectRatio,
  emptyLabel,
  onOpenImage,
}: {
  image: PreviewImage | null;
  aspectRatio: number;
  emptyLabel: string;
  onOpenImage: (image: PreviewImage) => void;
}) {
  const { aspectRatioStyle, onImageLoad } = useImageAspectRatio(
    aspectRatio,
    image?.src ?? null
  );
  return (
    <div
      className='aspect-[4/3] overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.24)]'
      style={aspectRatioStyle}
    >
      {image ? (
        <Button
          type='button'
          variant='ghost'
          className='block h-full w-full rounded-none p-0 hover:bg-transparent'
          onClick={() => onOpenImage(image)}
        >
          <img
            src={image.src}
            alt={image.alt}
            className={cn('h-full w-full object-cover')}
            onLoad={onImageLoad}
          />
        </Button>
      ) : (
        <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground'>
          <ImageOff className='h-5 w-5' />
          <span>{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
