import type { CastingCandidateStatus, CastingRoundKind } from '@gorenku/studio-core/client';
import { Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { CASTING_ROUND_KIND_LABELS } from './round-kind-labels';

const OVERLAY_ICON_BUTTON =
  'h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/70 hover:text-white';
const PILL_BUTTON = 'h-7 gap-1.5 rounded-md px-2 text-xs text-foreground hover:bg-item-hover-bg';

/** The hide toggle of a round image, drawn over it; "Show again" on a hidden one. */
export function CandidateHideToggle({ status, disabled = false, onHide, className }: {
  status: CastingCandidateStatus;
  disabled?: boolean;
  onHide: () => void;
  className?: string;
}) {
  const hidden = status === 'hidden';
  const HideIcon = hidden ? Eye : EyeOff;
  return (
    <Button
      type='button'
      variant='ghost'
      aria-label={hidden ? 'Show again' : 'Hide'}
      title={hidden ? 'Show again' : 'Hide'}
      aria-pressed={hidden}
      disabled={disabled}
      className={cn(OVERLAY_ICON_BUTTON, className)}
      onClick={onHide}
    >
      <HideIcon className='h-3 w-3' />
    </Button>
  );
}

/** A "✓ Cast" / "✓ Picked" marker on the round's choice, otherwise a Cast or Pick button when choosing is offered. */
export function CandidateChoiceAction({
  kind,
  isChosen,
  disabled = false,
  onChoose,
  className,
}: {
  kind: CastingRoundKind;
  isChosen: boolean;
  disabled?: boolean;
  onChoose?: () => void;
  className?: string;
}) {
  const labels = CASTING_ROUND_KIND_LABELS[kind];
  if (isChosen) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-take-shot-selected-border bg-take-shot-selected-bg px-2 py-px text-[10.5px] font-bold text-foreground', className)}>
        <Check aria-hidden='true' className='h-3 w-3' />
        {labels.chosen}
      </span>
    );
  }
  if (!onChoose) return null;
  return (
    <Button type='button' size='sm' disabled={disabled} className={cn('h-6 px-2.5 text-[11px]', className)} onClick={onChoose}>
      {labels.choose}
    </Button>
  );
}

/** Hide and Cast (or Pick) for the image shown in the image viewer, with words, for its zoom pill. */
export function CandidatePreviewActions(input: {
  kind: CastingRoundKind;
  status: CastingCandidateStatus;
  isChosen: boolean;
  disabled?: boolean;
  /** Choosing can be held back while hiding stays usable, for example while the agent is working. */
  chooseDisabled?: boolean;
  onHide: () => void;
  onChoose?: () => void;
}) {
  const hidden = input.status === 'hidden';
  const HideIcon = hidden ? Eye : EyeOff;
  return (
    <>
      <Button type='button' variant='ghost' aria-pressed={hidden} disabled={input.disabled} className={PILL_BUTTON} onClick={input.onHide}>
        <HideIcon aria-hidden='true' className='h-3.5 w-3.5' />
        {hidden ? 'Show again' : 'Hide'}
      </Button>
      <CandidateChoiceAction kind={input.kind} isChosen={input.isChosen} disabled={input.chooseDisabled ?? input.disabled} onChoose={input.onChoose} className='h-7' />
    </>
  );
}
