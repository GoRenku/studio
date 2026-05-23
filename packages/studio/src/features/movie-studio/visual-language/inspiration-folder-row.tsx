import type { InspirationFolder } from '@gorenku/studio-core/client';
import { Images } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { InspirationFolderDeleteDialog } from './inspiration-folder-delete-dialog';

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
      <InspirationFolderDeleteDialog folderName={folder.name} onDelete={onDelete} />
    </div>
  );
}
