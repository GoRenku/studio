import { useState, type ReactNode } from 'react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';

interface DeleteConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  message: string;
  onDelete: () => Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  message,
  onDelete,
}: DeleteConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controlled = open !== undefined;
  const dialogOpen = controlled ? open : internalOpen;
  const updateOpen = (nextOpen: boolean) => {
    if (!controlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) {
      return;
    }
    if (nextOpen) {
      setError(null);
    }
    updateOpen(nextOpen);
  };
  const handleDelete = async () => {
    setPending(true);
    setError(null);
    try {
      await onDelete();
      updateOpen(false);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error && deleteError.message.trim()
          ? deleteError.message
          : 'Unable to delete this item.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        showCloseButton={false}
        className='max-w-[min(360px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[var(--radius-panel)] border border-panel-border bg-panel-bg p-0 shadow-2xl'
      >
        <div className='px-6 py-5'>
          <DialogTitle className='truncate'>{title}</DialogTitle>
          <DialogDescription className='sr-only'>{message}</DialogDescription>
          <p className='mt-3 text-sm leading-6 text-muted-foreground'>{message}</p>
          {error ? (
            <p className='mt-3 text-sm text-destructive' role='alert'>
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className='border-t border-border/40 bg-dialog-footer-bg px-4 py-3'>
          <DialogClose asChild>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={pending}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='button'
            variant='destructive'
            size='sm'
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            {pending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
