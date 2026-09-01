import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioWaveformPlayer } from '@/ui/audio-waveform-player';
import { Card } from '@/ui/card';
import { VoiceOverProfilePlaceholder } from '@/ui/voice-over-profile-placeholder';
import type {
  MediaCardDeleteAction,
  MediaCardSelection,
} from './media-card-contract';
import { MediaCardActions } from './media-card-actions';

export interface MediaCardAudioTakeSpeaker {
  key: string;
  name: string;
  profileUrl: string | null;
  isVoiceOver: boolean;
}

export function MediaCardAudioTake(input: {
  turnLabel: string;
  audioUrl: string;
  durationSeconds: number | null;
  speakers: MediaCardAudioTakeSpeaker[];
  provenance: string;
  date: string;
  selected: boolean;
  selection: MediaCardSelection;
  deleteAction: MediaCardDeleteAction;
}) {
  return (
    <Card
      data-media-card=''
      className={cn(
        'group relative grid min-h-[220px] grid-cols-[190px_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border bg-background/70 p-5 shadow-none transition-colors',
        input.selected ? 'border-primary' : 'border-border/70 hover:border-border'
      )}
    >
      <div className='border-r border-border/60 pr-5'>
        <p className='mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary'>
          {input.turnLabel}
        </p>
        <SpeakerPortraitGrid speakers={input.speakers} />
      </div>
      <div className='flex min-w-0 flex-col justify-center pl-7 pr-4'>
        <AudioWaveformPlayer
          src={input.audioUrl}
          durationSeconds={input.durationSeconds}
          label={input.turnLabel}
        />
        <div className='mt-5 flex items-center justify-between gap-6 text-xs text-muted-foreground'>
          <span>{input.provenance}</span>
          <span className='shrink-0 pr-9'>{input.date}</span>
        </div>
      </div>
      <MediaCardActions selection={input.selection} deleteAction={input.deleteAction} />
    </Card>
  );
}

function SpeakerPortraitGrid({ speakers }: { speakers: MediaCardAudioTakeSpeaker[] }) {
  const visible = speakers.length > 4 ? speakers.slice(0, 3) : speakers.slice(0, 4);
  const multi = speakers.length > 1;
  return (
    <div className={cn(
      'overflow-hidden rounded-md border border-border/70 bg-muted/30',
      multi ? 'grid h-[132px] w-[132px] grid-cols-2 grid-rows-2 gap-1 p-1' : 'h-[132px] w-[132px]'
    )}>
      {visible.map((speaker) => (
        <Portrait key={speaker.key} speaker={speaker} />
      ))}
      {speakers.length > 4 ? (
        <div className='flex items-center justify-center rounded-sm border border-border/60 bg-muted/50 px-2 text-center text-xs text-muted-foreground'>
          +{speakers.length - 3} speakers
        </div>
      ) : null}
      {visible.length === 0 ? <Portrait speaker={{ key: 'empty', name: 'Speaker', profileUrl: null, isVoiceOver: false }} /> : null}
    </div>
  );
}

function Portrait({ speaker }: { speaker: MediaCardAudioTakeSpeaker }) {
  return speaker.profileUrl ? (
    <img
      src={speaker.profileUrl}
      alt={speaker.name}
      className='h-full min-h-0 w-full rounded-sm object-cover'
    />
  ) : speaker.isVoiceOver ? (
    <VoiceOverProfilePlaceholder />
  ) : (
    <div
      aria-label={`${speaker.name} has no selected profile image`}
      className='flex h-full min-h-0 w-full items-center justify-center rounded-sm bg-muted/70 text-muted-foreground'
    >
      <UserRound className='h-6 w-6' />
    </div>
  );
}
