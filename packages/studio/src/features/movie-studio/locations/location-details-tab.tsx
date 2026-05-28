import { useState, type ReactNode } from 'react';
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
  preferredLocationEnvironmentSheetAsset,
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
  const sheetAsset = preferredLocationEnvironmentSheetAsset(assets);
  const sheetPreview = sheetAsset
    ? locationEnvironmentSheetPreviewImages(projectName, locationId, sheetAsset)[0] ??
      null
    : resource.firstImage
      ? {
          src: resource.firstImage.url,
          alt: `${location.name} location sheet`,
          title: location.name,
        }
      : null;
  const sheetAspectRatio = sheetAsset
    ? locationEnvironmentSheetAspectRatio(sheetAsset, 4 / 3)
    : 4 / 3;

  return (
    <>
      <article className='min-h-full bg-panel-bg text-foreground'>
        <div className='bg-[linear-gradient(180deg,var(--panel-bg)_0%,var(--background)_360px,var(--panel-bg)_100%)]'>
          <div className='mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-12'>
            <header className='grid gap-8 pb-10 lg:grid-cols-[minmax(360px,520px)_minmax(0,1fr)] lg:gap-12'>
              <LocationFeatureImage
                image={sheetPreview}
                aspectRatio={sheetAspectRatio}
                emptyLabel='No location sheet yet'
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
              </div>
            </header>

            {location.visualNotes ? (
              <LocationReportSection
                number='01'
                kicker='Location Direction'
                title='Visual Notes'
              >
                <p className='max-w-[820px] whitespace-pre-wrap text-sm leading-7 text-foreground/78'>
                  {location.visualNotes}
                </p>
              </LocationReportSection>
            ) : null}
          </div>
        </div>
      </article>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function LocationReportSection({
  number,
  kicker,
  title,
  children,
}: {
  number: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className='grid gap-8 border-t border-border/40 py-10 sm:py-12 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)] lg:gap-12'>
      <div>
        <p className='font-mono text-xs uppercase text-muted-foreground'>
          {number} - {kicker}
        </p>
        <h2 className='mt-4 text-4xl font-black leading-none text-foreground sm:text-5xl xl:text-6xl'>
          {title}
        </h2>
      </div>
      <div className='min-w-0'>{children}</div>
    </section>
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
            className={cn('h-full w-full object-contain')}
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
