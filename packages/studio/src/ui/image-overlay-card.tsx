import { useState, type ReactNode } from 'react';
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
  previewContent?: ReactNode | ((state: { active: boolean }) => ReactNode);
  aspectClassName?: string;
  aspectRatio?: number;
  detectImageAspectRatio?: boolean;
  imageClassName?: string;
  overlayClassName?: string;
  selected?: boolean;
  topRightAction?: ReactNode;
  topRightActionClassName?: string;
  topRightActionPersistent?: boolean;
  bottomRightActions?: ReactNode;
  onOpen: () => void;
}

export function ImageOverlayCard({
  title,
  description,
  imageUrl,
  imageAlt,
  previewContent,
  aspectClassName = 'aspect-[16/10]',
  aspectRatio = 16 / 10,
  detectImageAspectRatio = false,
  imageClassName,
  overlayClassName,
  selected = false,
  topRightAction,
  topRightActionClassName,
  topRightActionPersistent = false,
  bottomRightActions,
  onOpen,
}: ImageOverlayCardProps) {
  const { aspectRatioStyle, onImageLoad } = useImageAspectRatio(
    aspectRatio,
    detectImageAspectRatio ? imageUrl : null
  );
  const hasCopy = Boolean(title || description);
  const [previewActive, setPreviewActive] = useState(false);
  const renderedPreviewContent =
    typeof previewContent === 'function'
      ? previewContent({ active: previewActive })
      : previewContent;

  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden rounded-md border bg-muted/25 py-0 shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_12px_24px_rgba(0,0,0,0.16)]',
        aspectClassName,
        selected
          ? 'border-primary/70 shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-1 ring-primary/35'
          : 'border-border/40'
      )}
      style={aspectRatioStyle}
    >
      <Button
        type='button'
        variant='ghost'
        aria-label={title ?? imageAlt}
        className='absolute inset-0 h-full w-full overflow-hidden rounded-[inherit] p-0 text-left hover:bg-transparent'
        onClick={onOpen}
        onPointerEnter={() => setPreviewActive(true)}
        onPointerLeave={() => setPreviewActive(false)}
        onFocus={() => setPreviewActive(true)}
        onBlur={() => setPreviewActive(false)}
      >
        {renderedPreviewContent ? (
          renderedPreviewContent
        ) : imageUrl ? (
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
      {hasCopy || bottomRightActions ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[inherit] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0.78)_100%)] px-4 pb-3 pt-12',
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
                <p className='mt-0.5 truncate text-xs leading-5 text-white/72'>
                  {description}
                </p>
              ) : null}
            </div>
            {bottomRightActions ? (
              <div className='pointer-events-auto flex shrink-0 items-center gap-2'>
                {bottomRightActions}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {topRightAction ? (
        <div
          className={cn(
            'absolute right-2 top-2 rounded-md bg-black/48 text-white shadow-sm backdrop-blur-sm transition-opacity',
            topRightActionClassName,
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
