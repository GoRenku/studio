import type { ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { useImageAspectRatio } from '@/ui/image-aspect-ratio';

interface ImageOverlayCardProps {
  title?: string;
  description?: string;
  imageUrl: string | null;
  imageAlt: string;
  aspectClassName?: string;
  aspectRatio?: number;
  detectImageAspectRatio?: boolean;
  imageClassName?: string;
  overlayClassName?: string;
  selected?: boolean;
  topRightAction?: ReactNode;
  topRightActionPersistent?: boolean;
  bottomRightControl?: ReactNode;
  onOpen: () => void;
}

export function ImageOverlayCard({
  title,
  description,
  imageUrl,
  imageAlt,
  aspectClassName = 'aspect-[16/10]',
  aspectRatio = 16 / 10,
  detectImageAspectRatio = false,
  imageClassName,
  overlayClassName,
  selected = false,
  topRightAction,
  topRightActionPersistent = false,
  bottomRightControl,
  onOpen,
}: ImageOverlayCardProps) {
  const { aspectRatioStyle, onImageLoad } = useImageAspectRatio(
    aspectRatio,
    detectImageAspectRatio ? imageUrl : null
  );
  const hasCopy = Boolean(title || description);

  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-visible rounded-md border bg-muted/25 py-0 shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_20px_42px_rgba(0,0,0,0.22)]',
        aspectClassName,
        selected
          ? 'border-primary/70 shadow-[0_18px_46px_rgba(0,0,0,0.26),0_0_0_1px_hsl(var(--primary)/0.22)]'
          : 'border-border/40'
      )}
      style={aspectRatioStyle}
    >
      <Button
        type='button'
        variant='ghost'
        className='absolute inset-0 h-full w-full overflow-hidden rounded-[inherit] p-0 text-left hover:bg-transparent'
        onClick={onOpen}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            className={cn(
              'h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]',
              imageClassName
            )}
            onLoad={detectImageAspectRatio ? onImageLoad : undefined}
          />
        ) : (
          <span className='flex h-full w-full items-center justify-center text-muted-foreground'>
            <ImageOff className='h-5 w-5' />
          </span>
        )}
      </Button>
      {hasCopy || bottomRightControl ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0.78)_100%)] px-4 pb-3 pt-12',
            overlayClassName
          )}
        >
          <div className='grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3'>
            <div className='min-w-0'>
              {title ? (
                <h3 className='truncate text-sm font-semibold leading-5 text-white'>
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className='mt-0.5 text-xs leading-5 text-white/72'>
                  {description}
                </p>
              ) : null}
            </div>
            {bottomRightControl ? (
              <div className='pointer-events-auto shrink-0'>
                {bottomRightControl}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {topRightAction ? (
        <div
          className={cn(
            'absolute right-2 top-2 rounded-md bg-black/48 text-white shadow-sm backdrop-blur-sm transition-opacity',
            topRightActionPersistent
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          )}
        >
          {topRightAction}
        </div>
      ) : null}
    </Card>
  );
}
