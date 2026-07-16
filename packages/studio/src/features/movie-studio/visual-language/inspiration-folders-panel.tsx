import type { InspirationResource } from '@gorenku/studio-core/client';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { EmptyState } from './empty-state';
import { InspirationFolderCard } from './inspiration-folder-card';

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
      <MediaCardGrid minimumCardWidthPx={240} gap='roomy'>
        {resource.folders.items.map((item) => (
          <InspirationFolderCard
            key={item.folder.id}
            projectName={projectName}
            item={item}
            onOpen={() => onOpenFolder(item.folder.id)}
            onDelete={() => onDeleteFolder(item.folder.id)}
          />
        ))}
      </MediaCardGrid>
    </div>
  );
}
