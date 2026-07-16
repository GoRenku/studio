import {
  useEffect,
  useRef,
  type CSSProperties,
  type SyntheticEvent,
} from 'react';
import { Film, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  MediaCardEmptyState,
  MediaCardFrame,
  MediaCardMedia,
  MediaCardPresentation,
  MediaCardVideo,
} from './media-card-contract';

interface MediaCardVisualProps {
  media: MediaCardMedia | null;
  frame: MediaCardFrame;
  presentation: MediaCardPresentation;
  emptyState?: MediaCardEmptyState;
  selected: boolean;
  active: boolean;
  aspectRatioStyle?: CSSProperties;
  onImageLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}

export function MediaCardVisual({
  media,
  frame,
  presentation,
  emptyState,
  selected,
  active,
  aspectRatioStyle,
  onImageLoad,
}: MediaCardVisualProps) {
  const option = isOptionMedia(media);

  return (
    <div
      data-media-card-visual=''
      className={cn(
        'relative w-full overflow-hidden bg-muted',
        frame.kind === 'ratio' && !aspectRatioStyle ? 'h-full' : null,
        presentation.kind === 'summary'
          ? 'border-b border-border/40 bg-muted/50'
          : null,
        presentation.kind === 'thumbnail' && option
          ? cn(
              'rounded-md border transition-colors',
              selected
                ? 'border-primary ring-1 ring-primary'
                : 'border-border/50 group-hover:border-border'
            )
          : null
      )}
      style={frameStyle(frame, aspectRatioStyle)}
    >
      {media ? (
        <MediaCardMediaVisual
          media={media}
          frame={frame}
          selected={selected}
          active={active}
          onImageLoad={onImageLoad}
        />
      ) : (
        <MediaCardEmptyVisual emptyState={emptyState} />
      )}
    </div>
  );
}

function MediaCardMediaVisual({
  media,
  frame,
  selected,
  active,
  onImageLoad,
}: {
  media: MediaCardMedia;
  frame: MediaCardFrame;
  selected: boolean;
  active: boolean;
  onImageLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}) {
  if (media.kind === 'video') {
    return (
      <MediaCardVideoVisual
        media={media}
        active={active}
        selected={selected}
      />
    );
  }
  if (media.kind === 'mosaic') {
    return (
      <div className='grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border/50'>
        {media.cells.map((cell) => (
          <div key={cell.id} className='min-h-0 overflow-hidden bg-muted'>
            {cell.src ? (
              <img
                src={cell.src}
                alt={cell.alt}
                className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]'
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <img
      src={media.src}
      alt={media.alt}
      loading={media.loading}
      className={cn(
        imageFrameClass(frame),
        media.fit === 'contain' ? 'object-contain' : 'object-cover',
        media.effect === 'zoom-on-hover'
          ? 'transition-transform duration-300 group-hover:scale-[1.025]'
          : null,
        media.effect === 'desaturate-until-hover-or-selected'
          ? cn(
              'transition duration-200',
              selected ? null : 'grayscale group-hover:grayscale-0'
            )
          : null
      )}
      onLoad={onImageLoad}
    />
  );
}

function isOptionMedia(media: MediaCardMedia | null): boolean {
  return (
    media?.kind === 'video' ||
    (media?.kind === 'image' &&
      media.effect === 'desaturate-until-hover-or-selected')
  );
}

function MediaCardVideoVisual({
  media,
  active,
  selected,
}: {
  media: MediaCardVideo;
  active: boolean;
  selected: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playsOnHover = media.playback !== 'still';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (!playsOnHover || !active) {
      if (!video.paused) {
        video.pause();
      }
      resetPreviewFrame(video);
      return;
    }
    const play = video.play();
    if (play) {
      void play.catch(() => resetPreviewFrame(video));
    }
  }, [active, playsOnHover]);

  const loop = media.playback === 'hover-muted-loop';
  return (
    <>
      {loop ? (
        <img
          src={media.posterSrc}
          alt=''
          aria-hidden='true'
          loading='lazy'
          className={cn(
            'h-full w-full object-cover transition duration-200',
            selected ? null : 'grayscale group-hover:grayscale-0'
          )}
        />
      ) : null}
      <video
        ref={videoRef}
        src={media.src}
        title={media.title}
        muted
        loop={loop}
        playsInline
        preload={active ? 'auto' : 'metadata'}
        className={cn(
          'h-full w-full object-cover',
          loop
            ? cn(
                'absolute inset-0 transition-opacity duration-200',
                active ? 'opacity-100' : 'opacity-0'
              )
            : null
        )}
      />
    </>
  );
}

function MediaCardEmptyVisual({
  emptyState,
}: {
  emptyState?: MediaCardEmptyState;
}) {
  if (emptyState?.kind === 'waveform') {
    return <WaveformPlaceholder />;
  }
  const Icon = emptyState?.kind === 'film' ? Film : ImageOff;
  return (
    <div
      data-media-card-empty-state={emptyState?.kind ?? 'image'}
      className='flex h-full min-h-24 w-full items-center justify-center px-6 text-muted-foreground'
    >
      <Icon className='h-5 w-5' />
    </div>
  );
}

function WaveformPlaceholder() {
  const barHeights = [24, 44, 68, 38, 82, 54, 30, 62, 46];
  return (
    <span
      aria-hidden='true'
      data-testid='voice-over-profile-placeholder'
      className='relative flex h-full min-h-24 w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_36%,rgba(217,177,102,0.18),transparent_34%),linear-gradient(145deg,rgba(28,31,32,0.96),rgba(12,13,14,1))]'
    >
      <span className='absolute inset-x-0 top-1/2 h-px bg-white/8' />
      <span className='flex h-24 w-40 items-center justify-center gap-2 rounded-full border border-white/8 bg-black/18 px-8 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm'>
        {barHeights.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className='w-1.5 rounded-full bg-[linear-gradient(180deg,rgba(244,213,151,0.95),rgba(113,156,171,0.72))] shadow-[0_0_14px_rgba(217,177,102,0.2)]'
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
    </span>
  );
}

function frameStyle(
  frame: MediaCardFrame,
  aspectRatioStyle: CSSProperties | undefined
): CSSProperties | undefined {
  if (frame.kind === 'ratio') {
    return aspectRatioStyle;
  }
  if (frame.kind === 'minimum-height') {
    return { minHeight: frame.minimumHeightPx };
  }
  return undefined;
}

function imageFrameClass(frame: MediaCardFrame): string {
  if (frame.kind === 'intrinsic') {
    return 'block h-auto w-full';
  }
  if (frame.kind === 'minimum-height') {
    return 'h-full min-h-[inherit] w-full';
  }
  return 'h-full w-full';
}

function resetPreviewFrame(video: HTMLVideoElement): void {
  try {
    video.currentTime = 0;
  } catch {
    // Browsers may reject currentTime changes before metadata is available.
  }
}
