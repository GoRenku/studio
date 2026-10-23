import type { InspirationResource } from '@gorenku/studio-core/client';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { Images } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
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
    return (
      <PanelEmptyState
        icon={Images}
        title='No inspiration yet'
        description='Use New Folder to collect reference images, such as stills from a film or a photographer you admire. Your agent can then analyze them for your lookbooks.'
      />
    );
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
