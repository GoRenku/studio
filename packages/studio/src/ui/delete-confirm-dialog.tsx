import { useId, useState, type ReactNode } from 'react';
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
import { Input } from '@/ui/input';

export interface DeleteConfirmationRequirement {
  expectedValue: string;
  instruction: string;
  label: string;
}

interface DeleteConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  message: string;
  confirmation?: DeleteConfirmationRequirement;
  deleteLabel?: string;
  onDelete: (confirmationValue?: string) => Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  message,
  confirmation,
  deleteLabel = 'Delete',
  onDelete,
}: DeleteConfirmDialogProps) {
  const confirmationInputId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationValue, setConfirmationValue] = useState('');
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
      setConfirmationValue('');
    }
    updateOpen(nextOpen);
  };
  const handleDelete = async () => {
    setPending(true);
    setError(null);
    try {
      await onDelete(confirmation ? confirmationValue : undefined);
      updateOpen(false);
      setConfirmationValue('');
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
          {confirmation ? (
            <div className='mt-5 space-y-2'>
              <label
                htmlFor={confirmationInputId}
                className='text-sm font-medium text-foreground'
              >
                {confirmation.label}
              </label>
              <p className='text-xs leading-5 text-muted-foreground'>
                {confirmation.instruction}
              </p>
              <Input
                id={confirmationInputId}
                value={confirmationValue}
                onChange={(event) => setConfirmationValue(event.target.value)}
                autoComplete='off'
                autoCapitalize='none'
                autoFocus
                disabled={pending}
                spellCheck={false}
              />
            </div>
          ) : null}
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
            disabled={
              pending ||
              Boolean(
                confirmation &&
                  confirmationValue !== confirmation.expectedValue
              )
            }
            onClick={() => void handleDelete()}
          >
            {pending ? 'Deleting...' : deleteLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
