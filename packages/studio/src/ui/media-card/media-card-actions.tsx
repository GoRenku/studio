import { Check, CircleDot, FileSearch, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import type {
  MediaCardDeleteAction,
  MediaCardCornerAction,
  MediaCardSelection,
} from './media-card-contract';

interface MediaCardActionsProps {
  selection?: MediaCardSelection;
  cornerAction?: MediaCardCornerAction;
  deleteAction?: MediaCardDeleteAction;
}

export function MediaCardActions({
  selection,
  cornerAction,
  deleteAction,
}: MediaCardActionsProps) {
  return (
    <>
      {selection || cornerAction ? (
        <div
          data-media-card-lower-actions=''
          className='pointer-events-auto absolute bottom-2 right-2 z-30 flex items-center gap-2'
        >
          {selection ? <MediaCardSelectionControl selection={selection} /> : null}
          {cornerAction ? <MediaCardCornerControl action={cornerAction} /> : null}
        </div>
      ) : null}
      {deleteAction ? (
        <div
          data-media-card-delete-action=''
          className='pointer-events-auto absolute right-2 top-2 z-30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
        >
          <MediaCardDeleteControl action={deleteAction} />
        </div>
      ) : null}
    </>
  );
}

function MediaCardSelectionControl({
  selection,
}: {
  selection: MediaCardSelection;
}) {
  const label = selection.selected
    ? selection.selectedLabel
    : selection.unselectedLabel;
  if (selection.kind === 'choose' && selection.selected) {
    return (
      <span
        role='status'
        aria-label={selection.selectedLabel}
        className='flex h-7 w-7 items-center justify-center rounded-full border border-primary/80 bg-primary text-primary-foreground shadow-[0_5px_12px_rgba(0,0,0,0.22)]'
      >
        <Check className='h-3.5 w-3.5' />
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant={selection.selected ? 'default' : 'ghost'}
          className={
            selection.selected
              ? 'h-7 w-7 rounded-full border border-primary/80 bg-primary text-primary-foreground shadow-[0_5px_12px_rgba(0,0,0,0.22)] hover:bg-primary/90'
              : 'h-7 w-7 rounded-full border border-white/22 bg-black/32 text-white/76 shadow-[0_5px_12px_rgba(0,0,0,0.16)] backdrop-blur-sm hover:bg-white/16 hover:text-white'
          }
          aria-label={label}
          aria-pressed={selection.selected}
          onClick={(event) => {
            const button = event.currentTarget;
            const action =
              selection.kind === 'toggle'
                ? selection.onToggle
                : selection.onChoose;
            void Promise.resolve(action()).finally(() =>
              button.blur()
            );
          }}
        >
          {selection.selected ? (
            <Check className='h-3.5 w-3.5' />
          ) : (
            <CircleDot className='h-3.5 w-3.5' />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  );
}

function MediaCardCornerControl({ action }: { action: MediaCardCornerAction }) {
  const Icon = action.kind === 'inspect' ? FileSearch : Pencil;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant='secondary'
          className={cn(
            'h-8 w-8 rounded-full border border-white/20 bg-black/60 text-white shadow-sm backdrop-blur-sm hover:bg-black/75 hover:text-white',
            action.visibility === 'hover-or-focus'
              ? 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
              : null
          )}
          aria-label={action.label}
          onClick={action.onAction}
        >
          <Icon className='h-3.5 w-3.5' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

function MediaCardDeleteControl({
  action,
}: {
  action: MediaCardDeleteAction;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex'>
          <DeleteConfirmDialog
            title={action.confirmationTitle}
            message={action.confirmationMessage}
            onDelete={action.onDelete}
            trigger={
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-7 w-7 rounded-md bg-black/50 text-white shadow-sm backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground'
                aria-label={action.label}
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            }
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}
