import type { InspirationFolder } from '@gorenku/studio-core/client';
import { InspirationFolderCreateDialog } from './inspiration-folder-create-dialog';
import { InspirationFolderRow } from './inspiration-folder-row';

interface InspirationFolderSidebarProps {
  folders: InspirationFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (folderId: string) => Promise<void>;
}

export function InspirationFolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
  onDelete,
}: InspirationFolderSidebarProps) {
  return (
    <aside className='flex min-h-0 flex-col rounded-md border border-border/40 bg-sidebar-bg/70'>
      <div className='border-b border-border/40 px-3 py-3'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Inspiration
        </p>
      </div>
      <div className='min-h-0 flex-1 space-y-1 overflow-y-auto p-2'>
        {folders.map((folder) => (
          <InspirationFolderRow
            key={folder.id}
            folder={folder}
            active={selectedFolderId === folder.id}
            onSelect={() => onSelect(folder.id)}
            onDelete={() => onDelete(folder.id)}
          />
        ))}
        {!folders.length ? (
          <p className='px-2 py-3 text-xs text-muted-foreground'>No folders yet.</p>
        ) : null}
      </div>
      <div className='border-t border-border/40 p-2'>
        <InspirationFolderCreateDialog onCreate={onCreate} />
      </div>
    </aside>
  );
}
