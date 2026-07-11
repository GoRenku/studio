import type { ReactNode } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import { ImageCardGrid } from '@/ui/image-card-grid';
import { ImageOverlayCard } from '@/ui/image-overlay-card';

export interface ImageCollectionItem {
  id: string;
  imageUrl: string | null;
  imageAlt: string;
  title?: string;
  description?: string;
  aspectClassName: string;
  aspectRatio: number;
  detectImageAspectRatio?: boolean;
  imageClassName?: string;
  selected?: boolean;
  bottomRightActions?: ReactNode;
  deleteAction?: {
    label: string;
    title: string;
    message: string;
    onDelete: () => Promise<void>;
  };
  onOpen: () => void;
}

interface ImageCollectionSectionProps {
  title: string;
  emptyTitle: string;
  items: ImageCollectionItem[];
  gridClassName: string;
}

export function ImageCollectionSection({
  title,
  emptyTitle,
  items,
  gridClassName,
}: ImageCollectionSectionProps) {
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
        <ImageCardGrid className={gridClassName}>
          {items.map((item) => (
            <ImageOverlayCard
              key={item.id}
              imageUrl={item.imageUrl}
              imageAlt={item.imageAlt}
              title={item.title}
              description={item.description}
              aspectClassName={item.aspectClassName}
              aspectRatio={item.aspectRatio}
              detectImageAspectRatio={item.detectImageAspectRatio}
              imageClassName={item.imageClassName}
              selected={item.selected}
              onOpen={item.onOpen}
              bottomRightActions={item.bottomRightActions}
              topRightAction={
                item.deleteAction ? (
                  <DeleteConfirmDialog
                    title={item.deleteAction.title}
                    message={item.deleteAction.message}
                    onDelete={item.deleteAction.onDelete}
                    trigger={
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
                        aria-label={item.deleteAction.label}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    }
                  />
                ) : undefined
              }
            />
          ))}
        </ImageCardGrid>
      ) : (
        <ImageCollectionEmptyState title={emptyTitle} />
      )}
    </section>
  );
}

function ImageCollectionEmptyState({ title }: { title: string }) {
  return (
    <div className='flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 p-6 text-center'>
      <ImageOff className='mb-3 h-5 w-5 text-muted-foreground' />
      <p className='text-sm font-medium text-foreground'>{title}</p>
    </div>
  );
}
