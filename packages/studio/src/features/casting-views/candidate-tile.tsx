import type { CastingCandidateStatus, CastingRoundKind } from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { CandidateChoiceAction, CandidateHideToggle } from './candidate-actions';
import { CASTING_ROUND_KIND_LABELS } from './round-kind-labels';

interface CandidateTileProps {
  kind: CastingRoundKind;
  /** Omitted while the image is still being generated. */
  imageUrl?: string;
  modelLabel?: string;
  status: CastingCandidateStatus;
  /** The round's choice: the cast candidate or the picked sheet. */
  isChosen: boolean;
  /** Shown in place of the image while it is still being generated. */
  pending?: { label: string };
  disabled?: boolean;
  onHide?: () => void;
  onChoose?: () => void;
  onOpen?: () => void;
}

/**
 * One image of a round: a casting candidate or a character sheet. At rest only the picture and its
 * Cast or Picked mark show; the model and the hide and choose actions the caller allows appear on
 * hover or keyboard focus.
 */
export function CandidateTile({
  kind,
  imageUrl,
  modelLabel,
  status,
  isChosen,
  pending,
  disabled = false,
  onHide,
  onChoose,
  onOpen,
}: CandidateTileProps) {
  const labels = CASTING_ROUND_KIND_LABELS[kind];
  if (pending || !imageUrl) {
    return (
      <div className={cn('grid place-items-center rounded-[9px] border border-border/40 bg-[repeating-linear-gradient(135deg,var(--muted)_0_10px,transparent_10px_20px)]', labels.aspectClassName)}>
        {pending ? (
          <span className='rounded-full bg-panel-bg px-2.5 py-1 text-[11.5px] text-muted-foreground'>{pending.label}</span>
        ) : null}
      </div>
    );
  }
  const hidden = status === 'hidden';
  const imageAlt = modelLabel ? `${labels.imageName} from ${modelLabel}` : labels.imageName;
  return (
    <figure
      className={cn(
        'group/tile relative overflow-hidden rounded-[9px] border border-border/40 bg-muted/30',
        labels.aspectClassName,
        isChosen ? 'outline-2 -outline-offset-2 outline-take-shot-selected-border' : null,
        hidden && !isChosen ? 'opacity-35' : null
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
      {isChosen ? <CandidateChoiceAction kind={kind} isChosen className='absolute left-1.5 top-1.5' /> : null}
      <figcaption className='absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1.5 pt-5 opacity-0 pointer-events-none transition-opacity group-focus-within/tile:pointer-events-auto group-focus-within/tile:opacity-100 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100'>
        <span className='min-w-0 flex-1 truncate text-[10.5px] font-semibold text-white'>{modelLabel}</span>
        {onHide ? <CandidateHideToggle status={status} disabled={disabled} onHide={onHide} /> : null}
        {isChosen ? null : <CandidateChoiceAction kind={kind} isChosen={false} disabled={disabled} onChoose={onChoose} />}
      </figcaption>
    </figure>
  );
}
