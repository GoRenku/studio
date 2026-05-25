import type { InspirationResource } from '@gorenku/studio-core/client';
import { EmptyState } from './empty-state';
import { InspirationFolderCard } from './inspiration-folder-card';
import { LookbookCardGrid } from './lookbook-card-grid';

interface InspirationFoldersPanelProps {
  projectName: string;
  resource: InspirationResource;
  onOpenFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => Promise<void>;
}

export function InspirationFoldersPanel({
  projectName,
  resource,
  onOpenFolder,
  onDeleteFolder,
}: InspirationFoldersPanelProps) {
  if (!resource.folders.items.length) {
    return <EmptyState title='Create an Inspiration folder to collect references.' />;
  }

  return (
    <div className='p-4 sm:p-5 lg:p-6'>
      <LookbookCardGrid>
        {resource.folders.items.map((item) => (
          <InspirationFolderCard
            key={item.folder.id}
            projectName={projectName}
            item={item}
            onOpen={() => onOpenFolder(item.folder.id)}
            onDelete={() => onDeleteFolder(item.folder.id)}
          />
        ))}
      </LookbookCardGrid>
    </div>
  );
}
