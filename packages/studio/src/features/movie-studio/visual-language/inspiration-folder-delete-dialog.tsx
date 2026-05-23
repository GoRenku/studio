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

interface InspirationFolderDeleteDialogProps {
  folderName: string;
  onDelete: () => Promise<void>;
}

export function InspirationFolderDeleteDialog({
  folderName,
  onDelete,
}: InspirationFolderDeleteDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className='h-6 w-6 rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          aria-label={`Delete ${folderName}`}
        >
          <Trash2 className='h-3.5 w-3.5' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md p-0'>
        <DialogHeader>
          <DialogTitle>Delete Inspiration Folder</DialogTitle>
          <DialogDescription>
            Delete {folderName} and the grabs stored in this folder.
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
