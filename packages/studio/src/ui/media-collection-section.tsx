import { ImageOff } from 'lucide-react';
import type { MediaCardProps } from '@/ui/media-card/media-card-contract';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';

export interface MediaCollectionItem {
  id: string;
  card: MediaCardProps;
}

interface MediaCollectionSectionProps {
  title: string;
  emptyTitle: string;
  items: MediaCollectionItem[];
  minimumCardWidthPx: number;
  gap?: 'compact' | 'standard' | 'roomy';
}

export function MediaCollectionSection({
  title,
  emptyTitle,
  items,
  minimumCardWidthPx,
  gap,
}: MediaCollectionSectionProps) {
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-4'>
        <div className='min-w-0'>
          <h2 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            {title}
          </h2>
        </div>
        <span className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/70'>
          {items.length === 1 ? '1 image' : `${items.length} images`}
        </span>
      </div>
      {items.length ? (
        <MediaCardGrid
          minimumCardWidthPx={minimumCardWidthPx}
          gap={gap}
        >
          {items.map((item) => (
            <MediaCard key={item.id} {...item.card} />
          ))}
        </MediaCardGrid>
      ) : (
        <div className='flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 p-6 text-center'>
          <ImageOff className='mb-3 h-5 w-5 text-muted-foreground' />
          <p className='text-sm font-medium text-foreground'>{emptyTitle}</p>
        </div>
      )}
    </section>
  );
}
