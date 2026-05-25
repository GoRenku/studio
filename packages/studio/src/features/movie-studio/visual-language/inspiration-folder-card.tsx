import type { InspirationFolderListItem } from '@gorenku/studio-core/client';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { VisualLanguageGalleryCard } from './visual-language-gallery-card';
import { inspirationImageUrl } from './visual-language-image-urls';

interface InspirationFolderCardProps {
  projectName: string;
  item: InspirationFolderListItem;
  onOpen: () => void;
  onDelete: () => Promise<void>;
}

export function InspirationFolderCard({
  projectName,
  item,
  onOpen,
  onDelete,
}: InspirationFolderCardProps) {
  const imageUrl = item.cardImage
    ? inspirationImageUrl(projectName, item.folder.id, item.cardImage.fileName)
    : null;
  const imageCountLabel =
    item.imageCount === 1 ? '1 image' : `${item.imageCount} images`;

  return (
    <VisualLanguageGalleryCard
      title={item.folder.name}
      description={imageCountLabel}
      imageUrl={imageUrl}
      imageAlt={`${item.folder.name} inspiration card image`}
      onOpen={onOpen}
      action={
        <DeleteConfirmDialog
          title='Delete Folder?'
          message={`Remove "${item.folder.name}" and its saved grabs.`}
          onDelete={onDelete}
          trigger={
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
              aria-label={`Delete ${item.folder.name}`}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          }
        />
      }
    />
  );
}
