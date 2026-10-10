import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createWaveformBars } from '@/lib/audio-waveform-bars';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

const WAVEFORM_BAR_COUNT = 96;
const WAVEFORM_BAR_MAX_HEIGHT = 46;

/**
 * Play button, click-to-seek waveform and duration rendered as three sibling
 * cells, so a parent grid can place them in its own columns.
 */
export function CompactAudioWaveformPlayer(input: {
  src?: string;
  durationSeconds: number | null;
  label: string;
  waveformSeed: string;
  autoPlay?: boolean;
  buttonClassName?: string;
  waveColor: string;
  progressColor: string;
  durationClassName?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number>();
  const duration = loadedDuration ?? input.durationSeconds ?? 0;
  const bars = useMemo(() => envelopeBars(createWaveformBars(input.waveformSeed, WAVEFORM_BAR_COUNT)), [input.waveformSeed]);
  const progress = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0;
  useEffect(() => {
    if (input.autoPlay && input.src) void audioRef.current?.play().catch(() => {});
  }, [input.autoPlay, input.src]);
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };
  const seek = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const position = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1) * duration;
    audio.currentTime = position;
    setCurrentTime(position);
    if (audio.paused) void audio.play();
  };
  return (
    <>
      <Button
        type='button'
        variant='ghost'
        className={cn('grid size-7 shrink-0 place-items-center rounded-full p-0 shadow-none', input.buttonClassName)}
        aria-label={`${playing ? 'Pause' : 'Play'} ${input.label}`}
        disabled={!input.src}
        onClick={toggle}
      >
        <svg viewBox='0 0 10 10' className='size-[13px] fill-current' aria-hidden>
          {playing ? <path d='M1 0h3v10H1zM6 0h3v10H6z' /> : <path d='M1.5 0l8 5-8 5z' />}
        </svg>
        {input.src ? (
          <audio
            ref={audioRef}
            src={input.src}
            preload='metadata'
            autoPlay={input.autoPlay}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              if (Number.isFinite(event.currentTarget.duration)) setLoadedDuration(event.currentTarget.duration);
            }}
          />
        ) : null}
      </Button>
      <div aria-hidden className='relative h-7 min-w-0 cursor-pointer' onClick={seek}>
        <WaveformBars bars={bars} color={input.waveColor} />
        <WaveformBars bars={bars} color={input.progressColor} progress={progress} />
      </div>
      <span className={cn('text-right tabular-nums', input.durationClassName)}>
        {duration > 0 ? `${duration.toFixed(1)}s` : ''}
      </span>
    </>
  );
}

function envelopeBars(bars: number[]): number[] {
  return bars.map((height, index) => height * (Math.sin((Math.PI * index) / bars.length) * 0.5 + 0.5));
}

function WaveformBars(input: { bars: number[]; color: string; progress?: number }) {
  return (
    <div
      data-audio-waveform-layer={input.progress === undefined ? 'base' : 'progress'}
      className='absolute inset-0 flex items-center justify-between overflow-hidden'
      style={{ color: input.color, ...(input.progress === undefined ? {} : { clipPath: `inset(0 ${(1 - input.progress) * 100}% 0 0)` }) }}
    >
      {input.bars.map((height, index) => (
        <span key={index} className='w-[2.5px] shrink-0 bg-current' style={{ height: `${Math.max(2 / 28, height / WAVEFORM_BAR_MAX_HEIGHT) * 100}%` }} />
      ))}
    </div>
  );
}
