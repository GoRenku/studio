import type { ImageRevisionMode } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { DialogFooter } from '@/ui/dialog';
import { GenerationRequestEstimate } from '@/features/generation-request-editor/generation-request-estimate';

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
      <div className='mr-auto'>
        <GenerationRequestEstimate
          pending={estimatePending}
          estimate={estimatedUsd === null ? undefined : {
            state: 'estimated',
            estimatedCostUsd: estimatedUsd,
          }}
        />
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
