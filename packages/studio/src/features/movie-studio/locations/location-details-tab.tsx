import { useState } from 'react';
import type {
  LocationResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { continuityPreviewImage } from '../continuity/continuity-image-assets';
import { LOCATION_DESCRIPTION_HEADINGS } from '../continuity/profile-description-headings';
import {
  ProfileDescriptionSections,
  ProfileSourceNote,
} from '../continuity/profile-description-sections';
import { ProfileMissingFields } from '../continuity/profile-missing-fields';
import { ProfileSideNote } from '../continuity/profile-side-note';

interface LocationDetailsTabProps {
  projectName: string;
  resource: LocationResourceResponse;
  assetFiles: StudioAssetFileResponse[];
  selectedHeroAssetFileId: string | null;
}

export function LocationDetailsTab({
  projectName,
  resource,
  assetFiles,
  selectedHeroAssetFileId,
}: LocationDetailsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const location = resource.location;
  const heroAssetFile = assetFiles.find(
    (assetFile) => assetFile.id === selectedHeroAssetFileId
  ) ?? null;
  const heroPreview = heroAssetFile
    ? continuityPreviewImage(projectName, heroAssetFile, 'Location Hero')
    : null;
  const missingFields = [
    ['Description', location.description],
    ['Visual notes', location.visualNotes],
  ].filter(([, value]) => !value).map(([label]) => label as string);

  return (
    <>
      <article className='min-h-full bg-panel-bg text-foreground'>
        {heroPreview ? (
          <Button
            type='button'
            variant='ghost'
            className='block h-[380px] w-full rounded-none border-b border-border/40 p-0 hover:bg-transparent'
            onClick={() => setPreviewImage(heroPreview)}
          >
            <img
              src={heroPreview.src}
              alt={heroPreview.alt}
              className='h-full w-full object-cover'
            />
          </Button>
        ) : null}
        <div className='grid gap-12 px-8 pb-16 pt-7 lg:grid-cols-[minmax(0,1fr)_300px]'>
          <div className='min-w-0'>
            <h1 className='text-balance text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground'>
              {location.name}
            </h1>
            {location.timePeriod ? (
              <p className='mt-2.5 text-[15px] font-medium text-muted-foreground'>
                {location.timePeriod}
              </p>
            ) : null}
            <ProfileDescriptionSections
              description={location.description}
              headings={LOCATION_DESCRIPTION_HEADINGS}
            />
            <ProfileSourceNote text={location.description?.sourceNotes} />
            <ProfileMissingFields fields={missingFields} />
          </div>
          <ProfileSideNote
            label='Visual notes'
            text={location.visualNotes}
            className='self-start lg:sticky lg:top-6'
          />
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
