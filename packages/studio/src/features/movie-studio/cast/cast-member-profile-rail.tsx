import { Pause, Play } from 'lucide-react';
import type { CastMember } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { Switch } from '@/ui/switch';
import { ContinuityFeatureImage } from '../continuity/continuity-feature-image';
import { useCastVoiceSamplePlayer } from './use-cast-voice-sample-player';

export function CastMemberProfileRail({
  castMember,
  profileImage,
  profileAspectRatio,
  voiceSampleUrl,
  onOpenImage,
  onVoiceOverChange,
}: {
  castMember: CastMember;
  profileImage: PreviewImage | null;
  profileAspectRatio: number;
  voiceSampleUrl: string | null;
  onOpenImage: (image: PreviewImage) => void;
  onVoiceOverChange: (isVoiceOver: boolean) => Promise<void>;
}) {
  const { audioRef, playing, toggle } = useCastVoiceSamplePlayer(voiceSampleUrl);

  return (
    <aside className='flex flex-col gap-[18px] self-start lg:sticky lg:top-6'>
      {castMember.isVoiceOver ? null : (
        <ContinuityFeatureImage
          image={profileImage}
          aspectClassName='aspect-square'
          aspectRatio={profileAspectRatio}
          emptyLabel='No profile image yet'
          onOpenImage={onOpenImage}
        />
      )}
      <div className='flex flex-col gap-3.5 border-t border-border/40 pt-4'>
        {voiceSampleUrl ? (
          <div className='flex items-center gap-2.5'>
            <Button
              type='button'
              size='icon'
              variant='secondary'
              className='h-[34px] w-[34px] shrink-0 rounded-full'
              onClick={toggle}
              aria-label={`${playing ? 'Pause' : 'Play'} ${castMember.name} voice sample`}
            >
              {playing ? <Pause className='h-3.5 w-3.5' /> : <Play className='h-3.5 w-3.5' />}
            </Button>
            <span className='text-[13px] font-semibold'>
              {playing ? 'Pause voice sample' : 'Play voice sample'}
            </span>
            <audio ref={audioRef} src={voiceSampleUrl} preload='metadata' />
          </div>
        ) : null}
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-[13px] font-semibold text-foreground'>Voice-over only</p>
            <p className='mt-0.5 text-xs leading-normal text-muted-foreground'>
              Heard but never seen on screen. Hides the portrait.
            </p>
          </div>
          <Switch
            checked={castMember.isVoiceOver}
            onCheckedChange={onVoiceOverChange}
            aria-label='Voice-over only'
          />
        </div>
      </div>
    </aside>
  );
}
