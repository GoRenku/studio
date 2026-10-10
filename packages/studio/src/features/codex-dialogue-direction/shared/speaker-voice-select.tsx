import type { DialogueDirectionVoice } from '@gorenku/studio-codex/dialogue-direction';
import { AudioPlayButton } from '@/ui/audio-play-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import type { DirectionMediaLibrary } from './use-direction-media';

export function SpeakerVoiceSelect(input: {
  speakerName: string;
  voices: DialogueDirectionVoice[];
  castVoiceId: string;
  media: DirectionMediaLibrary;
  onCastVoiceChange: (castVoiceId: string) => void;
}) {
  const voice = input.voices.find((candidate) => candidate.castVoiceId === input.castVoiceId);
  return (
    <span className='flex min-w-0 items-center gap-2'>
      <Select value={input.castVoiceId} onValueChange={input.onCastVoiceChange}>
        <SelectTrigger size='sm' aria-label={`Voice for ${input.speakerName}`} className='h-auto max-w-56 gap-1.5 rounded-[7px] border-[var(--dd-border)] bg-[var(--dd-card)] px-2 py-[5px] text-xs text-[var(--dd-card-fg)] shadow-none dark:bg-[var(--dd-card)] dark:hover:bg-[var(--dd-card)] [&_svg]:size-3.5'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {input.voices.map((candidate) => <SelectItem key={candidate.castVoiceId} value={candidate.castVoiceId}>{candidate.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {voice ? <AudioPlayButton key={voice.sampleUri} label={`${voice.name} voice sample`} className='border-[var(--dd-border)] bg-[var(--dd-card)] text-[var(--dd-fg)] shadow-none hover:bg-[var(--dd-hover)] [&_svg]:size-[13px]' loadSource={() => input.media.load(voice.sampleUri)} /> : null}
    </span>
  );
}
