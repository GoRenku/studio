import { cn } from '@/lib/utils';
import type { MediaCardMosaicGrid } from './media-card-contract';

export function MediaCardMosaicGridVisual({
  media,
}: {
  media: MediaCardMosaicGrid;
}) {
  const items =
    media.items.length > 9 ? media.items.slice(0, 8) : media.items.slice(0, 9);
  const overflow = media.items.length > 9 ? media.items.length - 8 : 0;
  return (
    <div
      data-media-card-mosaic-count={media.items.length}
      className={cn(
        'grid h-full w-full gap-px bg-border/50',
        mosaicGridClass(media.items.length)
      )}
    >
      {items.map((item) => (
        <div key={item.key} className='min-h-0 overflow-hidden bg-muted'>
          <img
            src={item.imageUrl}
            alt={item.alt}
            className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]'
          />
        </div>
      ))}
      {overflow ? (
        <div
          className='flex min-h-0 items-center justify-center bg-muted text-lg font-semibold text-muted-foreground'
          aria-label={`${overflow} more selected images`}
        >
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}

function mosaicGridClass(count: number): string {
  if (count <= 1) {
    return 'grid-cols-1 grid-rows-1';
  }
  if (count === 2) {
    return 'grid-cols-2 grid-rows-1';
  }
  if (count === 3) {
    return 'grid-cols-3 grid-rows-1';
  }
  if (count === 4) {
    return 'grid-cols-2 grid-rows-2';
  }
  if (count <= 6) {
    return 'grid-cols-3 grid-rows-2';
  }
  return 'grid-cols-3 grid-rows-3';
}
