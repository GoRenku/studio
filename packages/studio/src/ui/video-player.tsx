import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from './button';
import { Slider } from './slider';

interface VideoPlayerProps {
  src: string;
  title: string;
  className?: string;
  regenerateControl?: ReactNode;
}

export function VideoPlayer({
  src,
  title,
  className,
  regenerateControl,
}: VideoPlayerProps) {
  return (
    <VideoPlayerSurface
      key={src}
      src={src}
      title={title}
      className={className}
      regenerateControl={regenerateControl}
    />
  );
}

function VideoPlayerSurface({
  src,
  title,
  className,
  regenerateControl,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleTimelineChange = useCallback((value: number[]) => {
    const nextTime = value[0] ?? 0;
    const video = videoRef.current;
    if (video) {
      video.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
  }, []);

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border/40 bg-black'>
        <video
          ref={videoRef}
          src={src}
          title={title}
          playsInline
          preload='metadata'
          className={className}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
      <div className='flex items-center gap-3'>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          aria-label={playing ? 'Pause shot' : 'Play shot'}
          className='h-8 w-8 shrink-0'
          onClick={togglePlayback}
        >
          {playing ? (
            <Pause data-icon='inline-start' />
          ) : (
            <Play data-icon='inline-start' />
          )}
        </Button>
        <Slider
          aria-label='Shot timeline'
          value={[Math.min(currentTime, duration || currentTime)]}
          min={0}
          max={duration || 0}
          step={0.1}
          disabled={duration <= 0}
          onValueChange={handleTimelineChange}
          className='flex-1'
        />
        <span className='shrink-0 font-mono text-xs tabular-nums text-muted-foreground'>
          {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
        </span>
        {regenerateControl}
      </div>
    </div>
  );
}

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
