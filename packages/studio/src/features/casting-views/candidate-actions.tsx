import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

const OVERLAY_ICON_BUTTON =
  'h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/70 hover:text-white';
const PILL_BUTTON = 'h-7 gap-1.5 rounded-md px-2 text-xs text-foreground hover:bg-item-hover-bg';

/** The hide toggle of a casting candidate, drawn over its image; "Show again" on a hidden one. */
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

/** A "✓ Cast" marker on the cast candidate, otherwise a Cast button when casting is offered. */
export function CandidateCastAction({
  isCast,
  disabled = false,
  onCast,
  className,
}: {
  isCast: boolean;
  disabled?: boolean;
  onCast?: () => void;
  className?: string;
}) {
  if (isCast) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-take-shot-selected-border bg-take-shot-selected-bg px-2 py-px text-[10.5px] font-bold text-foreground', className)}>
        <Check aria-hidden='true' className='h-3 w-3' />
        Cast
      </span>
    );
  }
  if (!onCast) return null;
  return (
    <Button type='button' size='sm' disabled={disabled} className={cn('h-6 px-2.5 text-[11px]', className)} onClick={onCast}>
      Cast
    </Button>
  );
}

/** Hide and cast for the candidate shown in the image viewer, with words, for its zoom pill. */
export function CandidatePreviewActions(input: {
  status: CastingCandidateStatus;
  isCast: boolean;
  disabled?: boolean;
  /** Casting can be held back while hiding stays usable, for example while the agent is working. */
  castDisabled?: boolean;
  onHide: () => void;
  onCast?: () => void;
}) {
  const hidden = input.status === 'hidden';
  const HideIcon = hidden ? Eye : EyeOff;
  return (
    <>
      <Button type='button' variant='ghost' aria-pressed={hidden} disabled={input.disabled} className={PILL_BUTTON} onClick={input.onHide}>
        <HideIcon aria-hidden='true' className='h-3.5 w-3.5' />
        {hidden ? 'Show again' : 'Hide'}
      </Button>
      <CandidateCastAction isCast={input.isCast} disabled={input.castDisabled ?? input.disabled} onCast={input.onCast} className='h-7' />
    </>
  );
}
