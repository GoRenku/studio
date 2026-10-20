import { useState } from 'react';
import type {
  PropResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import {
  continuityImageAspectRatio,
  continuityImageAssetFiles,
  continuityPreviewImage,
} from '../continuity/continuity-image-assets';
import { ContinuityFeatureImage } from '../continuity/continuity-feature-image';
import { PROP_DESCRIPTION_HEADINGS } from '../continuity/profile-description-headings';
import {
  ProfileDescriptionSections,
  ProfileSourceNote,
} from '../continuity/profile-description-sections';
import { ProfileMissingFields } from '../continuity/profile-missing-fields';
import { ProfileSideNote } from '../continuity/profile-side-note';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';

export function PropDetailsTab({
  projectName,
  resource,
  assetFiles,
  selectedHeroAssetFileId,
}: {
  projectName: string;
  resource: PropResourceResponse;
  assetFiles: StudioAssetFileResponse[];
  selectedHeroAssetFileId: string | null;
}) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const prop = resource.prop;
  const hero = continuityImageAssetFiles(assetFiles, ['prop_hero']).find(
    (assetFile) => assetFile.id === selectedHeroAssetFileId
  );
  const heroPreview = hero
    ? continuityPreviewImage(projectName, hero, 'Prop Hero')
    : null;
  const missingFields = [
    ['Description', prop.description],
    ['Visual notes', prop.visualNotes],
  ].filter(([, value]) => !value).map(([label]) => label as string);

  return (
    <>
      <article className='min-h-full bg-panel-bg px-8 pb-16 pt-7 text-foreground'>
        <div className='grid gap-11 lg:grid-cols-[340px_minmax(0,1fr)]'>
          <aside className='flex flex-col gap-4 self-start lg:sticky lg:top-6'>
            <ContinuityFeatureImage
              image={heroPreview}
              aspectClassName='aspect-video'
              aspectRatio={hero ? continuityImageAspectRatio(hero, 16 / 9) : 16 / 9}
              emptyLabel='No prop hero image yet'
              onOpenImage={setPreviewImage}
            />
            <ProfileSideNote label='Visual notes' text={prop.visualNotes} />
          </aside>
          <div className='min-w-0'>
            <h1 className='text-balance text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground'>
              {prop.name}
            </h1>
            <ProfileDescriptionSections
              description={prop.description}
              headings={PROP_DESCRIPTION_HEADINGS}
            />
            <ProfileSourceNote text={prop.description?.sourceNotes} />
            <ProfileMissingFields fields={missingFields} />
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
