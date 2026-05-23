import type { LookbookListItem } from '@gorenku/studio-core/client';
import { ImageOff } from 'lucide-react';
import { Button } from '@/ui/button';
import { LookbookActiveControl } from './lookbook-active-control';
import { LookbookDeleteDialog } from './lookbook-delete-dialog';
import { lookbookImageFileUrl } from './visual-language-image-urls';

interface LookbookCardProps {
  projectName: string;
  item: LookbookListItem;
  onOpen: () => void;
  onSetActive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function LookbookCard({
  projectName,
  item,
  onOpen,
  onSetActive,
  onDelete,
}: LookbookCardProps) {
  const file = item.cardImage?.asset.files[0];
  const cardImageUrl =
    item.cardImage && file
      ? lookbookImageFileUrl(projectName, item.cardImage.id, file.id)
      : null;

  return (
    <article className='overflow-hidden rounded-md border border-border/40 bg-card'>
      <Button
        type='button'
        variant='ghost'
        className='block h-auto w-full rounded-none p-0 text-left hover:bg-transparent'
        onClick={onOpen}
      >
        <span className='block aspect-video bg-muted/30'>
          {cardImageUrl ? (
            <img
              src={cardImageUrl}
              alt={`${item.lookbook.name} lookbook card image`}
              className='h-full w-full object-cover'
            />
          ) : (
            <span className='flex h-full w-full items-center justify-center text-muted-foreground'>
              <ImageOff className='h-5 w-5' />
            </span>
          )}
        </span>
      </Button>
      <div className='space-y-3 border-t border-border/40 p-3'>
        <div className='min-w-0'>
          <h3 className='truncate text-sm font-semibold'>{item.lookbook.name}</h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            {item.isActive ? 'Active lookbook' : 'Not active'}
          </p>
        </div>
        <div className='flex items-center justify-between gap-2'>
          <LookbookActiveControl isActive={item.isActive} onSetActive={onSetActive} />
          <LookbookDeleteDialog
            lookbookName={item.lookbook.name}
            isActive={item.isActive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}
