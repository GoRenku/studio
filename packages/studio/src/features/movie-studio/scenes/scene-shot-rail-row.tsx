import { CheckCircle2, ImageOff, MinusCircle, PlusCircle } from 'lucide-react';
import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

interface SceneShotRailRowProps {
  label: string;
  title: string;
  image?: ScreenplayImageReferenceWithHttp;
  focused: boolean;
  selectedForEdit: boolean;
  selectionActionLabel?: 'Select Shot' | 'Expand Select' | 'Stop Select';
  onSelect: () => void;
  onChangeSelection?: () => void;
}

export function SceneShotRailRow({
  label,
  title,
  image,
  focused,
  selectedForEdit,
  selectionActionLabel,
  onSelect,
  onChangeSelection,
}: SceneShotRailRowProps) {
  return (
    <div className='group/card relative'>
      <Button
        type='button'
        variant='ghost'
        onClick={onSelect}
        aria-current={focused ? 'true' : undefined}
        aria-label={`${label} — ${title}`}
        data-selected-for-edit={selectedForEdit ? 'true' : undefined}
        className={cn(
          'h-auto w-full min-w-0 flex-col items-stretch gap-2 rounded-lg border p-2 text-left',
          selectedForEdit
            ? 'border-take-shot-selected-border bg-take-shot-selected-bg hover:border-take-shot-selected-border hover:bg-take-shot-selected-bg'
            : focused
              ? 'border-item-active-border bg-item-active-bg'
              : 'border-transparent bg-transparent hover:border-border/50 hover:bg-item-hover-bg',
          focused && selectedForEdit
            ? 'ring-1 ring-take-shot-selected-border'
            : ''
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
      {onChangeSelection && selectionActionLabel ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='secondary'
              size='icon'
              aria-label={`${selectionActionLabel} for ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onChangeSelection();
              }}
              className='absolute bottom-2 right-2 h-7 w-7 opacity-0 shadow-sm transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100'
            >
              <SelectionActionIcon label={selectionActionLabel} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side='right'>{selectionActionLabel}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function SelectionActionIcon({
  label,
}: {
  label: 'Select Shot' | 'Expand Select' | 'Stop Select';
}) {
  if (label === 'Stop Select') {
    return <MinusCircle className='h-3.5 w-3.5' />;
  }
  if (label === 'Expand Select') {
    return <PlusCircle className='h-3.5 w-3.5' />;
  }
  return <CheckCircle2 className='h-3.5 w-3.5' />;
}
