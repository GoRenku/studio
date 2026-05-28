import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/ui/dialog';
import { useImageAspectRatio } from '@/ui/image-aspect-ratio';

export interface PreviewImage {
  src: string;
  alt: string;
  title: string;
}

interface ImagePreviewDialogProps {
  images: PreviewImage[];
  currentIndex: number;
  onCurrentIndexChange?: (index: number) => void;
  onOpenChange: (open: boolean) => void;
}

export function ImagePreviewDialog({
  images,
  currentIndex,
  onCurrentIndexChange,
  onOpenChange,
}: ImagePreviewDialogProps) {
  const image = images[currentIndex] ?? null;
  const hasMultipleImages = images.length > 1;
  const { aspectRatio, aspectRatioStyle, onImageLoad } =
    useImageAspectRatio(16 / 9, image?.src ?? null);

  useEffect(() => {
    if (!hasMultipleImages || !onCurrentIndexChange) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onCurrentIndexChange(previousIndex(currentIndex, images.length));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onCurrentIndexChange(nextIndex(currentIndex, images.length));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, hasMultipleImages, images.length, onCurrentIndexChange]);

  return (
    <Dialog open={images.length > 0} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className='h-auto w-auto max-w-[calc(100vw-3rem)] gap-0 overflow-hidden rounded-[var(--radius-panel)] border border-panel-border bg-panel-bg p-0 shadow-2xl'
      >
        <DialogTitle className='sr-only'>{image?.title ?? 'Image Preview'}</DialogTitle>
        <DialogDescription className='sr-only'>
          {image?.alt ?? 'Expanded image preview.'}
        </DialogDescription>
        <DialogClose asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute right-2 top-2 z-10 h-7 w-7 rounded-md bg-panel-bg/80 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-item-hover-bg hover:text-foreground'
            aria-label='Close image preview'
          >
            <X className='h-3.5 w-3.5' />
          </Button>
        </DialogClose>
        {hasMultipleImages && onCurrentIndexChange ? (
          <>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute left-2 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-panel-bg/82 text-muted-foreground shadow-md backdrop-blur-sm hover:bg-item-hover-bg hover:text-foreground'
              aria-label='Show previous image'
              onClick={() =>
                onCurrentIndexChange(previousIndex(currentIndex, images.length))
              }
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute right-2 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-panel-bg/82 text-muted-foreground shadow-md backdrop-blur-sm hover:bg-item-hover-bg hover:text-foreground'
              aria-label='Show next image'
              onClick={() =>
                onCurrentIndexChange(nextIndex(currentIndex, images.length))
              }
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </>
        ) : null}
        {image ? (
          <div
            className='overflow-hidden bg-panel-bg'
            style={{
              ...aspectRatioStyle,
              width: `min(calc(100vw - 3rem), calc((100vh - 3rem) * ${aspectRatio}))`,
            }}
          >
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              className='block h-full w-full object-contain'
              onLoad={onImageLoad}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function previousIndex(currentIndex: number, imageCount: number): number {
  return (currentIndex - 1 + imageCount) % imageCount;
}

function nextIndex(currentIndex: number, imageCount: number): number {
  return (currentIndex + 1) % imageCount;
}
