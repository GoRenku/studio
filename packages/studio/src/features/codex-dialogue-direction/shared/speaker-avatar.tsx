import type { DialogueDirectionLine } from '@gorenku/studio-codex/dialogue-direction';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { speakerAvatarColour, speakerHue, speakerInitials, speakerTextColour } from './speaker-colour';
import { useDirectionMediaUrl, type DirectionMediaLibrary } from './use-direction-media';

export type DirectionSpeaker = Pick<DialogueDirectionLine, 'castMemberId' | 'speakerName' | 'profileUri'>;

export function SpeakerAvatar(input: {
  speaker: DirectionSpeaker;
  media: DirectionMediaLibrary;
  badge?: number | null;
  onActivate?: () => void;
  activateLabel?: string;
}) {
  const { speaker } = input;
  const hue = speakerHue(speaker.castMemberId, speaker.speakerName);
  const profile = useDirectionMediaUrl(input.media, speaker.profileUri);
  const face = (
    <>
      {profile.url
        ? <img src={profile.url} alt='' className='size-full rounded-full object-cover' />
        : <span aria-hidden>{speakerInitials(speaker.speakerName)}</span>}
      {input.badge ? (
        <span
          aria-hidden
          className='absolute -bottom-1 -right-1 grid size-[15px] place-items-center rounded-full border-[1.5px] border-current bg-[var(--dd-bg)] font-[family-name:var(--dd-font-mono)] text-[9px] font-semibold'
          style={{ color: speakerTextColour(hue) }}
        >
          {input.badge}
        </span>
      ) : null}
    </>
  );
  const className = 'relative grid size-[26px] shrink-0 place-items-center rounded-full text-[10px] font-bold text-white';
  if (input.onActivate) {
    return (
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className={cn(className, 'h-[26px] w-[26px] p-0 shadow-none hover:bg-transparent hover:text-white hover:shadow-[0_0_0_2px_var(--dd-primary)]')}
        style={{ backgroundColor: speakerAvatarColour(hue) }}
        aria-label={input.activateLabel}
        title={input.activateLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={input.onActivate}
      >
        {face}
      </Button>
    );
  }
  return <span className={className} style={{ backgroundColor: speakerAvatarColour(hue) }}>{face}</span>;
}
