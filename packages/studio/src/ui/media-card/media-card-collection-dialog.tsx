import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { MediaCard } from './media-card';
import type {
  MediaCardCollectionDialogPresentation,
  MediaCardCollectionDialogState,
} from './media-card-contract';
import { MediaCardGrid } from './media-card-grid';

interface MediaCardCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  state: MediaCardCollectionDialogState;
  presentation: MediaCardCollectionDialogPresentation;
  minimumCardWidthPx: number;
  gap?: 'compact' | 'standard' | 'roomy';
}

export function MediaCardCollectionDialog({
  open,
  onOpenChange,
  title,
  description,
  state,
  presentation,
  minimumCardWidthPx,
  gap,
}: MediaCardCollectionDialogProps) {
  const flush = presentation.kind === 'flush';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          flush
            ? 'max-h-[calc(100vh-3rem)] max-w-5xl gap-0 overflow-hidden p-0'
            : 'max-w-5xl'
        }
        data-media-card-collection-presentation={presentation.kind}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div
          className={
            flush
              ? 'max-h-[65vh] overflow-y-auto p-5'
              : 'max-h-[65vh] overflow-y-auto px-5 py-5'
          }
        >
          <MediaCardCollectionState
            state={state}
            minimumCardWidthPx={minimumCardWidthPx}
            gap={gap}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MediaCardCollectionState({
  state,
  minimumCardWidthPx,
  gap,
}: {
  state: MediaCardCollectionDialogState;
  minimumCardWidthPx: number;
  gap?: 'compact' | 'standard' | 'roomy';
}) {
  if (state.kind === 'loading' || state.kind === 'empty') {
    return (
      <p className='min-h-56 py-8 text-sm text-muted-foreground'>
        {state.message}
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className='flex min-h-56 flex-col items-center justify-center gap-3'>
        <p className='text-sm text-destructive'>{state.message}</p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={state.onRetry}
        >
          {state.retryLabel}
        </Button>
      </div>
    );
  }
  return (
    <MediaCardGrid minimumCardWidthPx={minimumCardWidthPx} gap={gap}>
      {state.items.map((item) => (
        <MediaCard key={item.id} {...item.card} />
      ))}
    </MediaCardGrid>
  );
}
