import { useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/ui/button';
import { Slider } from '@/ui/slider';

export function AudioWaveformPlayer(input: {
  src: string;
  durationSeconds: number | null;
  label: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(input.durationSeconds ?? 0);
  const bars = useMemo(() => createWaveformBars(input.src, 144), [input.src]);
  const progress = duration > 0
    ? Math.min(Math.max(currentTime / duration, 0), 1)
    : 0;
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };
  return (
    <div className='flex min-w-0 items-center gap-5'>
      <audio
        ref={audioRef}
        src={input.src}
        preload='metadata'
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='h-14 w-14 shrink-0 rounded-full border-primary/70 bg-primary/10 text-foreground hover:bg-primary/20'
        aria-label={`${playing ? 'Pause' : 'Play'} ${input.label}`}
        onClick={toggle}
      >
        {playing ? <Pause className='h-5 w-5' /> : <Play className='ml-0.5 h-5 w-5' />}
      </Button>
      <div className='min-w-0 flex-1'>
        <div aria-hidden className='relative h-12 w-full overflow-hidden'>
          <WaveformBars bars={bars} className='text-muted-foreground/55' />
          <WaveformBars
            bars={bars}
            className='absolute inset-0 text-primary'
            progress={progress}
          />
        </div>
        <div className='mt-1 text-sm tabular-nums text-muted-foreground'>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <Slider
          className='mt-3'
          sliderSize='sm'
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={[Math.min(currentTime, duration || 0)]}
          aria-label={`Playback position for ${input.label}`}
          onValueChange={([value]) => {
            if (audioRef.current && value !== undefined) {
              audioRef.current.currentTime = value;
              setCurrentTime(value);
            }
          }}
        />
      </div>
    </div>
  );
}

function WaveformBars(input: {
  bars: number[];
  className: string;
  progress?: number;
}) {
  return (
    <div
      data-audio-waveform-layer={input.progress === undefined ? 'base' : 'progress'}
      data-audio-waveform-progress={input.progress === undefined ? undefined : ''}
      className={`flex h-12 w-full items-center justify-between overflow-hidden ${input.className}`}
      style={input.progress === undefined
        ? undefined
        : { clipPath: `inset(0 ${(1 - input.progress) * 100}% 0 0)` }}
    >
      {input.bars.map((height, index) => (
        <span key={index} className='w-px shrink-0 rounded-full bg-current' style={{ height }} />
      ))}
    </div>
  );
}

function createWaveformBars(seed: string, count: number): number[] {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return Array.from({ length: count }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return 10 + Math.round(((state >>> 0) / 4294967295) * 36);
  });
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
