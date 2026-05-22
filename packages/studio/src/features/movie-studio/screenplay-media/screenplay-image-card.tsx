import type { ReactNode } from 'react';
import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';

interface ScreenplayImageCardProps {
  title: string;
  metadata?: string;
  image?: ScreenplayImageReferenceWithHttp;
  placeholder: ReactNode;
  onClick: () => void;
}

export function ScreenplayImageCard({
  title,
  metadata,
  image,
  placeholder,
  onClick,
}: ScreenplayImageCardProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      onClick={onClick}
      className='group h-auto min-w-0 flex-col overflow-hidden rounded-md border border-border/40 bg-card p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-item-active-border hover:bg-card'
    >
      <span className='aspect-[4/3] w-full overflow-hidden bg-muted'>
        {image ? (
          <img
            src={image.url}
            alt={title}
            className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]'
          />
        ) : (
          <span className='flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground'>
            {placeholder}
          </span>
        )}
      </span>
      <span className='flex w-full flex-col gap-1 px-3 py-3'>
        <span className='truncate text-sm font-semibold text-foreground'>{title}</span>
        {metadata ? (
          <span className='truncate text-xs text-muted-foreground'>{metadata}</span>
        ) : null}
      </span>
    </Button>
  );
}
