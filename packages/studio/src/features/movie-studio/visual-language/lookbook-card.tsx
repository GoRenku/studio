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
  onToggleSelection: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function LookbookCard({
  projectName,
  item,
  onOpen,
  onToggleSelection,
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
  const typeLabel = item.lookbook.type === 'movie' ? 'Movie' : 'Storyboard';
  const selectedLabel =
    item.lookbook.type === 'movie'
      ? 'Clear movie selection'
      : 'Clear storyboard selection';
  const unselectedLabel =
    item.lookbook.type === 'movie'
      ? 'Use for movie generation'
      : 'Use for storyboard images';

  return (
    <ImageOverlayCard
      title={item.lookbook.name}
      description={`${typeLabel} - ${sourceLabel}`}
      imageUrl={cardImageUrl}
      imageAlt={`${item.lookbook.name} lookbook card image`}
      selected={item.isSelectedForType}
      onOpen={onOpen}
      topRightAction={
        <DeleteConfirmDialog
          title='Delete Lookbook?'
          message={
            item.isSelectedForType
              ? `Remove "${item.lookbook.name}". The project will have no selected ${typeLabel.toLowerCase()} Lookbook.`
              : `Remove "${item.lookbook.name}". This cannot be undone.`
          }
          onDelete={onDelete}
          trigger={
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-7 text-white/75 hover:bg-destructive/80 hover:text-white'
              aria-label={`Delete ${item.lookbook.name}`}
            >
              <Trash2 data-icon='only' />
            </Button>
          }
        />
      }
      bottomRightControl={
        <ImageSelectionControl
          selected={item.isSelectedForType}
          selectedLabel={selectedLabel}
          unselectedLabel={unselectedLabel}
          onToggleSelected={onToggleSelection}
        />
      }
    />
  );
}
