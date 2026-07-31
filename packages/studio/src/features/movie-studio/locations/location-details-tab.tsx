import { useState } from 'react';
import type {
  LocationResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  continuityImageAspectRatio,
  continuityPreviewImage,
} from '../continuity/continuity-image-assets';
import { ContinuityFeatureImage } from '../continuity/continuity-feature-image';

interface LocationDetailsTabProps {
  projectName: string;
  resource: LocationResourceResponse;
  assets: StudioAssetResponse[];
  selectedHeroAssetId: string | null;
}

export function LocationDetailsTab({
  projectName,
  resource,
  assets,
  selectedHeroAssetId,
}: LocationDetailsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const location = resource.location;
  const heroAsset = assets.find(
    (asset) => asset.id === selectedHeroAssetId
  ) ?? null;
  const heroPreview = heroAsset
    ? continuityPreviewImage(projectName, heroAsset, 'Location Hero')
    : null;
  const heroAspectRatio = heroAsset
    ? continuityImageAspectRatio(heroAsset, 16 / 9)
    : 16 / 9;

  return (
    <>
      <article className='min-h-full bg-panel-bg px-4 py-5 text-foreground'>
        <header className='grid gap-6 pb-8 lg:grid-cols-[minmax(260px,390px)_minmax(0,1fr)] lg:gap-8'>
          <ContinuityFeatureImage
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
