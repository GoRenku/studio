import { useState } from 'react';
import type {
  PropResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  continuityImageAspectRatio,
  continuityImageAssets,
  continuityPreviewImage,
} from '../continuity/continuity-image-assets';
import { ContinuityFeatureImage } from '../continuity/continuity-feature-image';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';

export function PropDetailsTab({
  projectName,
  resource,
  assets,
  selectedHeroAssetId,
}: {
  projectName: string;
  resource: PropResourceResponse;
  assets: StudioAssetResponse[];
  selectedHeroAssetId: string | null;
}) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const prop = resource.prop;
  const hero = continuityImageAssets(assets, ['prop_hero']).find(
    (asset) => asset.id === selectedHeroAssetId
  );
  const heroPreview = hero
    ? continuityPreviewImage(projectName, hero, 'Prop Hero')
    : null;

  return (
    <>
      <article className='min-h-full bg-panel-bg px-4 py-5 text-foreground'>
        <header className='grid gap-6 pb-8 lg:grid-cols-[minmax(260px,390px)_minmax(0,1fr)] lg:gap-8'>
          <ContinuityFeatureImage
            image={heroPreview}
            aspectRatio={hero ? continuityImageAspectRatio(hero, 16 / 9) : 16 / 9}
            emptyLabel='No prop hero image yet'
            onOpenImage={setPreviewImage}
          />
          <div className='flex min-w-0 flex-col justify-end'>
            <h1 className='max-w-[920px] text-4xl font-black leading-none text-foreground sm:text-5xl lg:text-6xl'>
              {prop.name}
            </h1>
            {prop.description ? (
              <p className='mt-6 max-w-[780px] whitespace-pre-wrap text-base font-semibold leading-8 text-foreground/82 lg:text-lg'>
                {prop.description}
              </p>
            ) : null}
            {prop.visualNotes ? (
              <dl className='mt-7 grid gap-3 sm:grid-cols-2'>
                <div className='border-t border-border/40 pt-4'>
                  <dt className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                    Visual Notes
                  </dt>
                  <dd className='mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/78'>
                    {prop.visualNotes}
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
