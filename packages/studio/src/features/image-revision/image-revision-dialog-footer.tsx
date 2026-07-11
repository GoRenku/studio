import type { ImageRevisionMode } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { DialogFooter } from '@/ui/dialog';

const actionCopy = {
  regenerate: { idle: 'Regenerate', pending: 'Regenerating...' },
  edit: { idle: 'Edit', pending: 'Editing...' },
} satisfies Record<ImageRevisionMode, { idle: string; pending: string }>;

interface ImageRevisionDialogFooterProps {
  mode: ImageRevisionMode;
  estimatedUsd: number | null;
  estimatePending: boolean;
  runPending: boolean;
  canRun: boolean;
  onCancel: () => void;
  onRun: () => void;
}

export function ImageRevisionDialogFooter({
  mode,
  estimatedUsd,
  estimatePending,
  runPending,
  canRun,
  onCancel,
  onRun,
}: ImageRevisionDialogFooterProps) {
  const copy = actionCopy[mode];
  return (
    <DialogFooter className='items-center gap-3'>
      <div className='mr-auto text-sm text-muted-foreground'>
        {estimatePending
          ? 'Estimating...'
          : estimatedUsd !== null
            ? `Estimated cost $${estimatedUsd.toFixed(2)}`
            : 'Cost unavailable'}
      </div>
      <Button variant='outline' onClick={onCancel} disabled={runPending}>
        Cancel
      </Button>
      <Button onClick={onRun} disabled={!canRun || runPending}>
        {runPending ? copy.pending : copy.idle}
      </Button>
    </DialogFooter>
  );
}
