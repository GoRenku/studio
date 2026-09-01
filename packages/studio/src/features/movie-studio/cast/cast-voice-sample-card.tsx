import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import type { CastMemberResourceResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import { humanizeReferenceName } from './cast-reference-labels';
import { MediaCardActions } from '@/ui/media-card/media-card-actions';

type CastVoiceResponse = CastMemberResourceResponse['voices'][number];

interface CastVoiceSampleCardProps {
  voice: CastVoiceResponse;
  onDelete: (voice: CastVoiceResponse) => Promise<void>;
  onSelectDefault: (voice: CastVoiceResponse) => Promise<void>;
}

export function CastVoiceSampleCard({
  voice,
  onDelete,
  onSelectDefault,
}: CastVoiceSampleCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const file = voice.sample.files[0] ?? null;
  const label = humanizeReferenceName(voice.name);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    const updateProgress = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(1, audio.currentTime / audio.duration));
    };
    const stop = () => {
      setPlaying(false);
      updateProgress();
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', stop);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('pause', stop);
      audio.removeEventListener('ended', stop);
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    await audio.play();
    setPlaying(true);
  };

  return (
    <Card className={`group relative overflow-hidden rounded-md border bg-card p-0 shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(0,0,0,0.22)] ${voice.isDefault ? 'border-primary' : 'border-border/40 hover:border-border/70'}`}>
      <div className='grid min-h-[156px] grid-rows-[1fr_auto]'>
        <div className='flex items-center gap-4 p-4'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                size='icon'
                variant='secondary'
                className='h-11 w-11 shrink-0 rounded-full'
                onClick={togglePlayback}
                disabled={!file}
                aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}
              >
                {playing ? (
                  <Pause className='h-5 w-5' />
                ) : (
                  <Play className='h-5 w-5' />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{playing ? 'Pause sample' : 'Play sample'}</TooltipContent>
          </Tooltip>
          <div className='min-w-0 flex-1'>
            <div className='mb-3 flex items-center gap-2 text-muted-foreground'>
              <Volume2 className='h-4 w-4' />
              <span className='text-xs font-semibold uppercase tracking-[0.12em]'>
                Voice Sample
              </span>
            </div>
            <div
              role='progressbar'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className='h-2 overflow-hidden rounded-full bg-muted'
            >
              <div
                className='h-full bg-primary transition-[width]'
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
        <div className='border-t border-border/40 px-4 py-3'>
          <h3 className='truncate text-sm font-semibold text-foreground'>
            {label}
          </h3>
          <p className='mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground'>
            {voice.purpose}
          </p>
        </div>
      </div>
      {file ? <audio ref={audioRef} src={file.url} preload='metadata' /> : null}
      <MediaCardActions
        selection={{
          kind: 'choose',
          selected: voice.isDefault,
          selectedLabel: 'Default voice sample',
          unselectedLabel: 'Set as default voice sample',
          onChoose: () => onSelectDefault(voice),
        }}
        deleteAction={{
          label: 'Delete voice sample',
          confirmationTitle: 'Delete Voice Sample?',
          confirmationMessage: 'Remove this Cast Voice and its linked sample. This cannot be undone.',
          onDelete: () => onDelete(voice),
        }}
      />
    </Card>
  );
}
