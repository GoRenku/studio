import { useState } from 'react';
import type {
  CastMemberResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import {
  continuityImageAspectRatio,
  continuityPreviewImage,
} from '../continuity/continuity-image-assets';
import { CAST_MEMBER_DESCRIPTION_HEADINGS } from '../continuity/profile-description-headings';
import {
  ProfileDescriptionSections,
  ProfileSourceNote,
  ProfileTextSection,
} from '../continuity/profile-description-sections';
import { ProfileMissingFields } from '../continuity/profile-missing-fields';
import { CastMemberProfileRail } from './cast-member-profile-rail';
import { CastMemberStorySummary } from './cast-member-story-summary';

interface CastMemberDetailsTabProps {
  projectName: string;
  resource: CastMemberResourceResponse;
  assetFiles: StudioAssetFileResponse[];
  selectedProfileAssetFileId: string | null;
  onVoiceOverChange: (isVoiceOver: boolean) => Promise<void>;
}

export function CastMemberDetailsTab({
  projectName,
  resource,
  assetFiles,
  selectedProfileAssetFileId,
  onVoiceOverChange,
}: CastMemberDetailsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const castMember = resource.castMember;
  const profileAssetFile = assetFiles.find(
    (assetFile) => assetFile.id === selectedProfileAssetFileId
  ) ?? null;
  const roleLine = [
    castMember.role,
    castMember.age === undefined ? null : `Age ${castMember.age}`,
  ].filter(Boolean).join(' · ');
  const missingFields = [
    ['Want', castMember.want],
    ['Need', castMember.need],
    ['Arc', castMember.arc],
    ['Description', castMember.description],
    ['Voice notes', castMember.voiceNotes],
  ].filter(([, value]) => !value).map(([label]) => label as string);

  return (
    <>
      <article className='min-h-full bg-panel-bg px-8 pb-16 pt-7 text-foreground'>
        <div className='grid gap-12 lg:grid-cols-[280px_minmax(0,1fr)]'>
          <CastMemberProfileRail
            castMember={castMember}
            profileImage={
              profileAssetFile
                ? continuityPreviewImage(projectName, profileAssetFile, 'Profile')
                : null
            }
            profileAspectRatio={
              profileAssetFile ? continuityImageAspectRatio(profileAssetFile, 1) : 1
            }
            voiceSampleUrl={resource.voices[0]?.sample?.url ?? null}
            onOpenImage={setPreviewImage}
            onVoiceOverChange={onVoiceOverChange}
          />
          <div className='min-w-0'>
            <h1 className='text-balance text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground'>
              {castMember.name}
            </h1>
            {roleLine ? (
              <p className='mt-2.5 max-w-[62ch] text-[15px] font-medium leading-normal text-muted-foreground'>
                {roleLine}
              </p>
            ) : null}
            <CastMemberStorySummary castMember={castMember} />
            <ProfileDescriptionSections
              description={castMember.description}
              headings={CAST_MEMBER_DESCRIPTION_HEADINGS}
            />
            {castMember.voiceNotes ? (
              <ProfileTextSection heading='Voice' text={castMember.voiceNotes} />
            ) : null}
            <ProfileSourceNote text={castMember.description?.sourceNotes} />
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
