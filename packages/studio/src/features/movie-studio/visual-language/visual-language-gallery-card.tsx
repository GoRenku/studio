import type { ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';

interface VisualLanguageGalleryCardProps {
  title: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string;
  emphasized?: boolean;
  action?: ReactNode;
  control?: ReactNode;
  onOpen: () => void;
}

export function VisualLanguageGalleryCard({
  title,
  description,
  imageUrl,
  imageAlt,
  emphasized = false,
  action,
  control,
  onOpen,
}: VisualLanguageGalleryCardProps) {
  return (
    <Card
      className={cn(
        'group relative aspect-[16/10] gap-0 overflow-visible rounded-md border bg-muted/25 py-0 shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_20px_42px_rgba(0,0,0,0.22)]',
        emphasized
          ? 'border-primary/70 shadow-[0_18px_46px_rgba(0,0,0,0.26),0_0_0_1px_hsl(var(--primary)/0.22)]'
          : 'border-border/40'
      )}
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
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]'
          />
        ) : (
          <span className='flex h-full w-full items-center justify-center text-muted-foreground'>
            <ImageOff className='h-5 w-5' />
          </span>
        )}
      </Button>
      <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0.78)_100%)] px-4 pb-3 pt-12'>
        <div className='grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3'>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold leading-5 text-white'>
              {title}
            </h3>
            <p className='mt-0.5 text-xs leading-5 text-white/72'>{description}</p>
          </div>
          {control ? <div className='pointer-events-auto shrink-0'>{control}</div> : null}
        </div>
      </div>
      {action ? (
        <div className='absolute right-2 top-2 rounded-md bg-black/48 text-white opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'>
          {action}
        </div>
      ) : null}
    </Card>
  );
}
