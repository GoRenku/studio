import type { InspirationFolder } from '@gorenku/studio-core/client';
import { Images, Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { cn } from '@/lib/utils';

interface InspirationFolderRowProps {
  folder: InspirationFolder;
  active: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
}

export function InspirationFolderRow({
  folder,
  active,
  onSelect,
  onDelete,
}: InspirationFolderRowProps) {
  return (
    <div className='group flex items-center gap-1'>
      <Button
        type='button'
        variant='ghost'
        className={cn(
          'h-9 min-w-0 flex-1 justify-start gap-2 px-2',
          active ? 'bg-item-active-bg text-item-active-fg' : ''
        )}
        onClick={onSelect}
      >
        <Images className='h-3.5 w-3.5 shrink-0' />
        <span className='truncate'>{folder.name}</span>
      </Button>
      <DeleteConfirmDialog
        title='Delete Folder?'
        message={`Remove "${folder.name}" and its saved grabs.`}
        onDelete={onDelete}
        trigger={
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='h-6 w-6 rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
            aria-label={`Delete ${folder.name}`}
          >
            <Trash2 className='h-3.5 w-3.5' />
          </Button>
        }
      />
    </div>
  );
}
