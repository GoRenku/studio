import { useEffect, useRef, useState } from 'react';
import { ImageOff, Pause, Volume2 } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  CAST_PROFILE_ROLE,
  castImageAssetAspectRatio,
  castPreviewImageForAsset,
  preferredCastImageAssetForRole,
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
  const firstVoice = resource.voices[0] ?? null;
  const firstVoiceFile = firstVoice?.sample.files[0] ?? null;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const profilePreview = profileAsset
    ? castPreviewImageForAsset(projectName, castMemberId, profileAsset)
    : null;
  const profileAspectRatio = profileAsset
    ? castImageAssetAspectRatio(profileAsset, 1)
    : 1;
  const facts = [
    ['Role', castMember.role],
    ['Age', castMember.age?.toString()],
    ['Want', castMember.want],
    ['Need', castMember.need],
    ['Arc', castMember.arc],
    ['Voice Notes', castMember.voiceNotes],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    const stop = () => setVoicePlaying(false);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', stop);
    return () => {
      audio.pause();
      audio.removeEventListener('pause', stop);
      audio.removeEventListener('ended', stop);
    };
  }, [firstVoiceFile?.url]);

  const toggleVoicePreview = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (voicePlaying) {
      audio.pause();
      setVoicePlaying(false);
      return;
    }
    await audio.play();
    setVoicePlaying(true);
  };

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
            <div className='mt-4 flex max-w-[920px] flex-wrap items-center gap-3'>
              <h1 className='min-w-0 text-4xl font-black leading-none text-foreground sm:text-5xl lg:text-6xl'>
                {castMember.name}
              </h1>
              {firstVoiceFile ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type='button'
                      size='icon'
                      variant='secondary'
                      className='mt-1 h-9 w-9 shrink-0 rounded-full'
                      onClick={toggleVoicePreview}
                      aria-label={`${voicePlaying ? 'Pause' : 'Play'} ${castMember.name} voice sample`}
                    >
                      {voicePlaying ? (
                        <Pause className='h-4 w-4' />
                      ) : (
                        <Volume2 className='h-4 w-4' />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {voicePlaying ? 'Pause voice sample' : `Play ${castMember.name} voice sample`}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            {firstVoiceFile ? (
              <audio ref={audioRef} src={firstVoiceFile.url} preload='metadata' />
            ) : null}
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

      </article>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
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
