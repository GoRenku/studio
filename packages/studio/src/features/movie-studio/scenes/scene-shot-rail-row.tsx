import { ImageOff, Link2 } from 'lucide-react';
import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

interface SceneShotRailRowProps {
  label: string;
  title: string;
  image?: ScreenplayImageReferenceWithHttp;
  selected: boolean;
  onSelect: () => void;
  onCycleGroup: () => void;
}

export function SceneShotRailRow({
  label,
  title,
  image,
  selected,
  onSelect,
  onCycleGroup,
}: SceneShotRailRowProps) {
  return (
    <div className='group/card relative'>
      <Button
        type='button'
        variant='ghost'
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        aria-label={`${label} — ${title}`}
        className={cn(
          'h-auto w-full min-w-0 flex-col items-stretch gap-2 rounded-lg border p-2 text-left',
          selected
            ? 'border-item-active-border bg-item-active-bg'
            : 'border-transparent bg-transparent hover:border-border/50 hover:bg-item-hover-bg'
        )}
      >
        <span className='aspect-[4/3] w-full overflow-hidden rounded-md bg-muted'>
          {image ? (
            <img
              src={image.url}
              alt={`${label} — ${title}`}
              className='h-full w-full object-cover'
            />
          ) : (
            <span className='flex h-full items-center justify-center text-muted-foreground'>
              <ImageOff className='h-4 w-4' />
            </span>
          )}
        </span>
        <span className='flex min-h-8 w-full flex-col justify-end gap-0.5'>
          <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            {label}
          </span>
          <span className='truncate text-xs font-medium text-foreground/90'>
            {title}
          </span>
        </span>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            variant='secondary'
            size='icon'
            aria-label={`Cycle grouping for ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onCycleGroup();
            }}
            className='absolute bottom-2 right-2 h-7 w-7 opacity-0 shadow-sm transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100'
          >
            <Link2 className='h-3.5 w-3.5' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='right'>Cycle shot group</TooltipContent>
      </Tooltip>
    </div>
  );
}
