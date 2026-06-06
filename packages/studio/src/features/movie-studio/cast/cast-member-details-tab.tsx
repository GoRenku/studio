import { useState, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  CastMemberResourceResponse,
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
  CAST_CHARACTER_SHEET_ROLE,
  CAST_PROFILE_ROLE,
  castImageAssetAspectRatio,
  castPreviewImageForAsset,
  preferredCastImageAssetForRole,
  selectedCastImageAssetForRole,
} from './cast-member-assets';

interface CastMemberDetailsTabProps {
  projectName: string;
  castMemberId: string;
  resource: CastMemberResourceResponse;
  assets: StudioAssetResponse[];
}

export function CastMemberDetailsTab({
  projectName,
  castMemberId,
  resource,
  assets,
}: CastMemberDetailsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const castMember = resource.castMember;
  const profileAsset = preferredCastImageAssetForRole(assets, CAST_PROFILE_ROLE);
  const characterSheetAsset = selectedCastImageAssetForRole(
    assets,
    CAST_CHARACTER_SHEET_ROLE
  );
  const profilePreview = profileAsset
    ? castPreviewImageForAsset(projectName, castMemberId, profileAsset)
    : null;
  const profileAspectRatio = profileAsset
    ? castImageAssetAspectRatio(profileAsset, 1)
    : 1;
  const characterSheetPreview = characterSheetAsset
    ? castPreviewImageForAsset(projectName, castMemberId, characterSheetAsset)
    : null;
  const characterSheetAspectRatio = characterSheetAsset
    ? castImageAssetAspectRatio(characterSheetAsset, 4 / 3)
    : 4 / 3;
  const facts = [
    ['Role', castMember.role],
    ['Age', castMember.age?.toString()],
    ['Want', castMember.want],
    ['Need', castMember.need],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  return (
    <>
      <article className='min-h-full bg-panel-bg px-4 py-5 text-foreground'>
        <header className='grid gap-6 pb-8 lg:grid-cols-[minmax(260px,390px)_minmax(0,1fr)] lg:gap-8'>
          <CastFeatureImage
            image={profilePreview}
            aspectClassName='aspect-square'
            aspectRatio={profileAspectRatio}
            emptyLabel='No profile image yet'
            onOpenImage={setPreviewImage}
          />
          <div className='flex min-w-0 flex-col justify-end'>
            <div className='flex flex-wrap items-center gap-2'>
              {castMember.role ? (
                <span className='rounded-full border border-border/50 bg-muted/45 px-3 py-1 text-xs font-semibold text-foreground/75'>
                  {castMember.role}
                </span>
              ) : null}
            </div>
            <h1 className='mt-4 max-w-[920px] text-4xl font-black leading-none text-foreground sm:text-5xl lg:text-6xl'>
              {castMember.name}
            </h1>
            {castMember.description ? (
              <p className='mt-6 max-w-[780px] text-base font-semibold leading-8 text-foreground/82 lg:text-lg'>
                {castMember.description}
              </p>
            ) : null}
            {facts.length ? (
              <dl className='mt-7 grid gap-3 sm:grid-cols-2'>
                {facts.map(([label, value]) => (
                  <div key={label} className='border-t border-border/40 pt-4'>
                    <dt className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                      {label}
                    </dt>
                    <dd className='mt-2 text-sm leading-6 text-foreground/78'>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </header>

        <CastReportSection number='01' kicker='Visual Anchor' title='Character Sheet'>
          <div className='grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(260px,0.65fr)]'>
            <CastFeatureImage
              image={characterSheetPreview}
              aspectClassName='aspect-[4/3]'
              aspectRatio={characterSheetAspectRatio}
              imageClassName='object-contain'
              emptyLabel='No character sheet pick yet'
              onOpenImage={setPreviewImage}
            />
            <div className='space-y-5'>
              <TextSection title='Arc' text={castMember.arc} />
              <TextSection title='Voice Notes' text={castMember.voiceNotes} />
            </div>
          </div>
        </CastReportSection>
      </article>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function CastReportSection({
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
    <section className='grid gap-6 border-t border-border/40 py-8 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)] lg:gap-8'>
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

function CastFeatureImage({
  image,
  aspectClassName,
  aspectRatio,
  imageClassName,
  emptyLabel,
  onOpenImage,
}: {
  image: PreviewImage | null;
  aspectClassName: string;
  aspectRatio: number;
  imageClassName?: string;
  emptyLabel: string;
  onOpenImage: (image: PreviewImage) => void;
}) {
  const {
    aspectRatioStyle,
    onImageLoad,
  } = useImageAspectRatio(aspectRatio, image?.src ?? null);
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.24)]',
        aspectClassName
      )}
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
            className={cn('h-full w-full object-cover', imageClassName)}
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

function TextSection({ title, text }: { title: string; text?: string }) {
  if (!text) {
    return null;
  }
  return (
    <section className='space-y-2 border-t border-border/40 pt-4'>
      <h3 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        {title}
      </h3>
      <p className='whitespace-pre-wrap text-sm leading-7 text-foreground/78'>
        {text}
      </p>
    </section>
  );
}
