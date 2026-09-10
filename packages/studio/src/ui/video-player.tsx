import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref, type SyntheticEvent } from 'react';
import { Maximize, Minimize, Pause, Play } from 'lucide-react';
import { Button } from './button';
import { Slider } from './slider';

type VideoPlayerProps = {
  src: string;
  title: string;
  className?: string;
  ref?: Ref<VideoPlayerHandle>;
  controls?: 'inline' | 'external';
  onTimeChange?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onSeek?: (seconds: number) => void;
  onError?: () => void;
  onEnded?: () => void;
} & (
  | { onPlaybackRequest: () => void; playing: boolean }
  | { onPlaybackRequest?: never; playing?: never }
);

export interface VideoPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  setMuted: (muted: boolean) => void;
  getCurrentTime: () => number;
}

export function VideoPlayer({
  src,
  title,
  className,
  ...playbackProps
}: VideoPlayerProps) {
  return (
    <VideoPlayerSurface
      key={src}
      src={src}
      title={title}
      className={className}
      {...playbackProps}
    />
  );
}

function VideoPlayerSurface({
  src,
  title,
  className,
  ref,
  controls = 'inline',
  onTimeChange,
  onDurationChange,
  onPlayingChange,
  onSeek,
  onError,
  onPlaybackRequest,
  playing: transportPlaying,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenTrigger = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const controlsPlaying = onPlaybackRequest ? transportPlaying : playing;

  useImperativeHandle(ref, () => ({
    play: async () => { await videoRef.current?.play(); },
    pause: () => videoRef.current?.pause(),
    seek: (seconds) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration)) {
        return;
      }
      video.currentTime = Math.min(Math.max(0, seconds), video.duration);
      setCurrentTime(video.currentTime);
    },
    setMuted: (muted) => { if (videoRef.current) videoRef.current.muted = muted; },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
  }), []);

  useEffect(() => {
    const updateFullscreen = () => {
      const active = document.fullscreenElement === playerRef.current;
      setFullscreen(active);
      if (!active && fullscreenTrigger.current) {
        requestAnimationFrame(() => {
          if (fullscreenTrigger.current?.isConnected) fullscreenTrigger.current.focus();
          else playerRef.current?.querySelector<HTMLButtonElement>('button[aria-label^="Enter fullscreen"]')?.focus();
          fullscreenTrigger.current = null;
        });
      }
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    setFullscreenError(null);
    try {
      if (document.fullscreenElement === playerRef.current) {
        await document.exitFullscreen();
      } else {
        fullscreenTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        await playerRef.current?.requestFullscreen();
      }
    } catch {
      setFullscreenError('Fullscreen could not be opened or closed. Please try again.');
    }
  };

  const togglePlayback = useCallback(() => {
    if (onPlaybackRequest) { onPlaybackRequest(); return; }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play().catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setMediaError(true);
      });
    } else {
      video.pause();
    }
  }, [onPlaybackRequest]);

  const handlePlayingChange = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    // Queued events can describe a command superseded by a later play or pause.
    const playing = !event.currentTarget.paused && !event.currentTarget.ended;
    setPlaying(playing);
    onPlayingChange?.(playing);
  }, [onPlayingChange]);

  const handleTimelineChange = useCallback((value: number[]) => {
    const nextTime = value[0] ?? 0;
    const video = videoRef.current;
    if (video) {
      video.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
    onSeek?.(nextTime);
  }, [onSeek]);

  return (
    <div ref={playerRef} data-controls={controls} className='relative flex h-full min-h-0 flex-col gap-3 fullscreen:bg-background fullscreen:p-5'>
      <div className='relative min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border/40 bg-black'>
        <video
          ref={videoRef}
          src={src}
          title={title}
          playsInline
          preload='metadata'
          onError={() => { setMediaError(true); onError?.(); }}
          className={fullscreen ? 'h-full w-full object-contain' : className}
          onLoadedMetadata={(event) => {
            const seconds = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
            setDuration(seconds);
            onDurationChange?.(seconds);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
            onTimeChange?.(event.currentTarget.currentTime);
          }}
          onPlay={handlePlayingChange}
          onPause={handlePlayingChange}
          onEnded={(event) => { handlePlayingChange(event); if (event.currentTarget.ended) onEnded?.(); }}
        />
        {mediaError ? <div role='status' className='absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground'>Video unavailable</div> : null}
      </div>
      {controls === 'external' && !fullscreen ? (
        <Button
          type='button'
          size='icon'
          variant='ghost'
          aria-label={`Enter fullscreen: ${title}`}
          title={`Enter fullscreen: ${title}`}
          className='absolute right-2 bottom-2 h-8 w-8 bg-black/45 text-white hover:bg-black/65 hover:text-white'
          onClick={() => void toggleFullscreen()}
        >
          <Maximize />
        </Button>
      ) : null}
      {controls === 'inline' || fullscreen ? (
      <div className='flex items-center gap-3'>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          aria-label={controlsPlaying ? 'Pause shot' : 'Play shot'}
          className='h-8 w-8 shrink-0'
          onClick={togglePlayback}
        >
          {controlsPlaying ? (
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
        <Button
          type='button'
          size='icon'
          variant='ghost'
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className='h-8 w-8 shrink-0'
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </div>
      ) : null}
      {fullscreenError ? <p role='alert' className={controls === 'external' && !fullscreen ? 'absolute top-2 right-2 left-2 rounded bg-background/90 p-2 text-xs text-destructive' : 'text-xs text-destructive'}>{fullscreenError}</p> : null}
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
