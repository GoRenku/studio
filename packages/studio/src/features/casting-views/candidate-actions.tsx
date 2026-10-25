import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import { Star, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

const OVERLAY_ICON_BUTTON =
  'h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/70 hover:text-white';
const OVERLAY_ICON_BUTTON_ON = 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground';

interface CandidateStatusTogglesProps {
  status: CastingCandidateStatus;
  disabled?: boolean;
  onShortlist?: () => void;
  onHide?: () => void;
  className?: string;
}

/** The shortlist and hide toggles of a casting candidate, drawn over its image. */
export function CandidateStatusToggles({ status, disabled = false, onShortlist, onHide, className }: CandidateStatusTogglesProps) {
  if (!onShortlist && !onHide) return null;
  const shortlisted = status === 'shortlisted';
  const hidden = status === 'hidden';
  return (
    <span className={cn('flex gap-1', className)}>
      {onShortlist ? (
        <Button
          type='button'
          variant='ghost'
          aria-label={shortlisted ? 'Remove from shortlist' : 'Shortlist'}
          title={shortlisted ? 'Remove from shortlist' : 'Shortlist'}
          aria-pressed={shortlisted}
          disabled={disabled}
          className={cn(OVERLAY_ICON_BUTTON, shortlisted ? OVERLAY_ICON_BUTTON_ON : null)}
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
          title={hidden ? 'Show again' : 'Hide'}
          aria-pressed={hidden}
          disabled={disabled}
          className={cn(OVERLAY_ICON_BUTTON, hidden ? OVERLAY_ICON_BUTTON_ON : null)}
          onClick={onHide}
        >
          <X className='h-3 w-3' />
        </Button>
      ) : null}
    </span>
  );
}

/** A small round icon button drawn over an image, such as the challenger's make-favorite and remove actions. */
export function OverlayIconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type='button' variant='ghost' aria-label={label} title={label} disabled={disabled} className={OVERLAY_ICON_BUTTON} onClick={onClick}>
      {children}
    </Button>
  );
}

/** A "Cast" marker on the cast candidate, otherwise a Cast button when casting is offered. */
export function CandidateCastAction({ isCast, disabled = false, onCast, className }: { isCast: boolean; disabled?: boolean; onCast?: () => void; className?: string }) {
  if (isCast) {
    return (
      <span className={cn('rounded-full border border-take-shot-selected-border bg-take-shot-selected-bg px-2 py-px text-[10.5px] font-bold text-foreground', className)}>
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

/** Shortlist, hide and cast for the candidate shown in the image viewer. */
export function CandidatePreviewActions(input: {
  status: CastingCandidateStatus;
  isCast: boolean;
  disabled?: boolean;
  /** Casting can be held back while the status toggles stay usable, for example while the agent is working. */
  castDisabled?: boolean;
  onShortlist: () => void;
  onHide: () => void;
  onCast?: () => void;
}) {
  return (
    <>
      <CandidateStatusToggles status={input.status} disabled={input.disabled} onShortlist={input.onShortlist} onHide={input.onHide} className='gap-1.5' />
      <CandidateCastAction isCast={input.isCast} disabled={input.castDisabled ?? input.disabled} onCast={input.onCast} className='h-7' />
    </>
  );
}
