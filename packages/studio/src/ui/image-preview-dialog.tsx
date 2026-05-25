import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/ui/dialog';

export interface PreviewImage {
  src: string;
  alt: string;
  title: string;
}

interface ImagePreviewDialogProps {
  image: PreviewImage | null;
  onOpenChange: (open: boolean) => void;
}

export function ImagePreviewDialog({
  image,
  onOpenChange,
}: ImagePreviewDialogProps) {
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    setAspectRatio(16 / 9);
  }, [image?.src]);

  return (
    <Dialog open={Boolean(image)} onOpenChange={onOpenChange}>
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
        {image ? (
          <div
            className='overflow-hidden bg-panel-bg'
            style={{
              aspectRatio,
              width: `min(calc(100vw - 3rem), calc((100vh - 3rem) * ${aspectRatio}))`,
            }}
          >
            <img
              src={image.src}
              alt={image.alt}
              className='block h-full w-full object-contain'
              onLoad={(event) => {
                const { naturalHeight, naturalWidth } = event.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) {
                  setAspectRatio(naturalWidth / naturalHeight);
                }
              }}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
