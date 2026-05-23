import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';

interface LookbookDeleteDialogProps {
  lookbookName: string;
  isActive: boolean;
  onDelete: () => Promise<void>;
}

export function LookbookDeleteDialog({
  lookbookName,
  isActive,
  onDelete,
}: LookbookDeleteDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type='button' size='icon' variant='ghost' aria-label={`Delete ${lookbookName}`}>
          <Trash2 className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md p-0'>
        <DialogHeader>
          <DialogTitle>Delete Lookbook</DialogTitle>
          <DialogDescription>
            Delete {lookbookName}. This cannot be undone.
            {isActive
              ? ' This lookbook is currently active. Deleting it will leave the project with no active lookbook.'
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type='button' variant='ghost'>Cancel</Button>
          </DialogClose>
          <Button type='button' variant='destructive' onClick={() => void onDelete()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
