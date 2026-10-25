import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { CandidateCastAction, CandidateStatusToggles } from './candidate-actions';

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
      {isCast ? <CandidateCastAction isCast className='absolute left-1.5 top-1.5' /> : null}
      <CandidateStatusToggles
        status={status}
        disabled={disabled}
        onShortlist={onShortlist}
        onHide={onHide}
        className='absolute right-1.5 top-1.5'
      />
      {modelLabel ? (
        <figcaption className='absolute bottom-1.5 left-1.5 max-w-[calc(100%-4.5rem)] truncate rounded-full bg-black/60 px-[7px] py-px text-[10.5px] font-semibold text-white'>
          {modelLabel}
        </figcaption>
      ) : null}
      {isCast ? null : (
        <CandidateCastAction isCast={false} disabled={disabled} onCast={onCast} className='absolute bottom-1.5 right-1.5' />
      )}
    </figure>
  );
}
