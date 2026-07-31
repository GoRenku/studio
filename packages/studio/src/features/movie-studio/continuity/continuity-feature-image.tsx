import { ImageOff } from 'lucide-react';
import { Button } from '@/ui/button';
import { useImageAspectRatio } from '@/ui/image-aspect-ratio';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { cn } from '@/lib/utils';

export function ContinuityFeatureImage({
  image,
  aspectRatio,
  emptyLabel,
  onOpenImage,
  aspectClassName = 'aspect-[4/3]',
}: {
  image: PreviewImage | null;
  aspectRatio: number;
  emptyLabel: string;
  onOpenImage: (image: PreviewImage) => void;
  aspectClassName?: string;
}) {
  const { aspectRatioStyle, onImageLoad } = useImageAspectRatio(
    aspectRatio,
    image?.src ?? null
  );
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/40 bg-card shadow-[0_18px_45px_rgba(0,0,0,0.24)]',
        aspectClassName
      )}
      style={aspectRatioStyle}
    >
      {image ? (
        <Button
          type='button'
          variant='ghost'
          className='block h-full w-full rounded-none p-0 hover:bg-transparent'
          onClick={() => onOpenImage(image)}
        >
          <img
            src={image.src}
            alt={image.alt}
            className='h-full w-full object-cover'
            onLoad={onImageLoad}
          />
        </Button>
      ) : (
        <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground'>
          <ImageOff className='h-5 w-5' />
          <span>{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
