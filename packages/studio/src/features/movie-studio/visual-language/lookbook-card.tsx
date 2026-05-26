import type { LookbookListItemWithSources } from '@gorenku/studio-core/client';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { lookbookImageFileUrl } from './visual-language-image-urls';

interface LookbookCardProps {
  projectName: string;
  item: LookbookListItemWithSources;
  onOpen: () => void;
  onToggleActive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function LookbookCard({
  projectName,
  item,
  onOpen,
  onToggleActive,
  onDelete,
}: LookbookCardProps) {
  const file = item.cardImage?.asset.files[0];
  const cardImageUrl =
    item.cardImage && file
      ? lookbookImageFileUrl(projectName, item.cardImage.id, file.id)
      : null;
  const sourceCount = item.sourceInspirationFolders.length;
  const sourceLabel =
    sourceCount === 1 ? '1 source' : `${sourceCount} sources`;

  return (
    <ImageOverlayCard
      title={item.lookbook.name}
      description={sourceLabel}
      imageUrl={cardImageUrl}
      imageAlt={`${item.lookbook.name} lookbook card image`}
      selected={item.isActive}
      onOpen={onOpen}
      topRightAction={
        <DeleteConfirmDialog
          title='Delete Lookbook?'
          message={
            item.isActive
              ? `Remove "${item.lookbook.name}". The project will have no active lookbook.`
              : `Remove "${item.lookbook.name}". This cannot be undone.`
          }
          onDelete={onDelete}
          trigger={
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
              aria-label={`Delete ${item.lookbook.name}`}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          }
        />
      }
      bottomRightControl={
        <ImageSelectionControl
          selected={item.isActive}
          selectedLabel='Clear active lookbook'
          unselectedLabel='Set active lookbook'
          onToggleSelected={onToggleActive}
        />
      }
    />
  );
}
