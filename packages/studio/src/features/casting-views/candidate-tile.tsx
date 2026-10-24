import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

interface CandidateTileProps {
  /** Omitted while the candidate is still being generated. */
  imageUrl?: string;
  modelLabel?: string;
  status: CastingCandidateStatus;
  isCast: boolean;
  /** Shown in place of the image while the candidate is still being generated. */
  pending?: { label: string };
  disabled?: boolean;
  onShortlist?: () => void;
  onHide?: () => void;
  onCast?: () => void;
  onOpen?: () => void;
}

const OVERLAY_ICON_BUTTON =
  'h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/70 hover:text-white';

/** One casting candidate: the image, its model, and the shortlist, hide and cast actions the caller allows. */
export function CandidateTile({
  imageUrl,
  modelLabel,
  status,
  isCast,
  pending,
  disabled = false,
  onShortlist,
  onHide,
  onCast,
  onOpen,
}: CandidateTileProps) {
  if (pending || !imageUrl) {
    return (
      <div className='grid aspect-[4/3] place-items-center rounded-[9px] border border-border/40 bg-[repeating-linear-gradient(135deg,var(--muted)_0_10px,transparent_10px_20px)]'>
        {pending ? (
          <span className='rounded-full bg-panel-bg px-2.5 py-1 text-[11.5px] text-muted-foreground'>{pending.label}</span>
        ) : null}
      </div>
    );
  }
  const shortlisted = status === 'shortlisted';
  const hidden = status === 'hidden';
  const imageAlt = modelLabel ? `Casting candidate from ${modelLabel}` : 'Casting candidate';
  return (
    <figure
      className={cn(
        'relative aspect-[4/3] overflow-hidden rounded-[9px] border border-border/40 bg-muted/30',
        shortlisted ? 'outline-2 -outline-offset-2 outline-primary' : null,
        isCast ? 'outline-2 -outline-offset-2 outline-take-shot-selected-border' : null,
        hidden && !isCast ? 'opacity-35' : null
      )}
    >
      {onOpen ? (
        <Button
          type='button'
          variant='ghost'
          aria-label={`Open ${imageAlt.toLowerCase()}`}
          className='h-full w-full rounded-none p-0 hover:bg-transparent'
          onClick={onOpen}
        >
          <img src={imageUrl} alt={imageAlt} className='h-full w-full object-contain' />
        </Button>
      ) : (
        <img src={imageUrl} alt={imageAlt} className='h-full w-full object-contain' />
      )}
      {isCast ? (
        <span className='absolute left-1.5 top-1.5 rounded-full border border-take-shot-selected-border bg-take-shot-selected-bg px-2 py-px text-[10.5px] font-bold text-foreground'>
          Cast
        </span>
      ) : null}
      {onShortlist || onHide ? (
        <span className='absolute right-1.5 top-1.5 flex gap-1'>
          {onShortlist ? (
            <Button
              type='button'
              variant='ghost'
              aria-label={shortlisted ? 'Remove from shortlist' : 'Shortlist'}
              aria-pressed={shortlisted}
              disabled={disabled}
              className={cn(OVERLAY_ICON_BUTTON, shortlisted ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : null)}
              onClick={onShortlist}
            >
              <Star className='h-3 w-3' />
            </Button>
          ) : null}
          {onHide ? (
            <Button
              type='button'
              variant='ghost'
              aria-label={hidden ? 'Show again' : 'Hide'}
              aria-pressed={hidden}
              disabled={disabled}
              className={cn(OVERLAY_ICON_BUTTON, hidden ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : null)}
              onClick={onHide}
            >
              <X className='h-3 w-3' />
            </Button>
          ) : null}
        </span>
      ) : null}
      {modelLabel ? (
        <figcaption className='absolute bottom-1.5 left-1.5 max-w-[calc(100%-4.5rem)] truncate rounded-full bg-black/60 px-[7px] py-px text-[10.5px] font-semibold text-white'>
          {modelLabel}
        </figcaption>
      ) : null}
      {onCast && !isCast ? (
        <Button
          type='button'
          size='sm'
          disabled={disabled}
          className='absolute bottom-1.5 right-1.5 h-6 px-2.5 text-[11px]'
          onClick={onCast}
        >
          Cast
        </Button>
      ) : null}
    </figure>
  );
}
