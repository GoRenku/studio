import { Check, Film } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

export interface OptionTileProps {
  label: string;
  /** Color source image. Rendered desaturated until hover/selected. */
  imageUrl?: string;
  /** Optional motion preview; plays on hover for motion-capable tiles. */
  videoUrl?: string;
  selected: boolean;
  onSelect: () => void;
  aspect?: 'video' | 'square';
  disabled?: boolean;
}

/**
 * Single rendered selection tile (0036). The source asset is color; the idle
 * state is desaturated in CSS and returns to color on hover and while selected,
 * so we never store duplicate grayscale files.
 */
export function OptionTile({
  label,
  imageUrl,
  videoUrl,
  selected,
  onSelect,
  aspect = 'video',
  disabled,
}: OptionTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {
      /* autoplay can reject before user gesture; ignore */
    });
  };

  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <button
      type='button'
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      onMouseEnter={videoUrl ? playPreview : undefined}
      onMouseLeave={videoUrl ? stopPreview : undefined}
      className='group flex flex-col gap-1.5 rounded-lg text-left focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
    >
      <span
        className={cn(
          'relative block w-full overflow-hidden rounded-md border bg-muted/40 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring',
          aspect === 'video' ? 'aspect-video' : 'aspect-square',
          selected
            ? 'border-primary ring-1 ring-primary'
            : 'border-border/50 group-hover:border-border'
        )}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=''
              loading='lazy'
              className={cn(
                'h-full w-full object-cover transition duration-200',
                selected ? '' : 'grayscale group-hover:grayscale-0'
              )}
            />
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                preload='none'
                className='absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100'
              />
            ) : null}
          </>
        ) : (
          <span className='flex h-full w-full items-center justify-center text-muted-foreground/40'>
            <Film className='h-5 w-5' />
          </span>
        )}
        {selected ? (
          <span className='absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow'>
            <Check className='h-3 w-3' />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'px-0.5 text-center text-[11px] leading-tight',
          selected ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </button>
  );
}
