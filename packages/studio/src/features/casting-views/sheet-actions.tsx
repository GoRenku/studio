import { Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

/** Opens a character sheet in the image viewer; sits in a corner of the sheet, whose own click picks it. */
export function ExpandSheetButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type='button'
      variant='ghost'
      aria-label='View sheet large'
      title='View large'
      className={cn('h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/70 hover:text-white', className)}
      onClick={onClick}
    >
      <Maximize2 className='h-3 w-3' />
    </Button>
  );
}

/** Pick for the sheet shown in the image viewer, or a "Picked" marker once it is the costume's sheet. */
export function PickSheetAction({ picked, disabled = false, onPick }: { picked: boolean; disabled?: boolean; onPick: () => void }) {
  if (picked) {
    return (
      <span className='rounded-full border border-take-shot-selected-border bg-take-shot-selected-bg px-2 py-px text-[10.5px] font-bold text-foreground'>
        Picked
      </span>
    );
  }
  return (
    <Button type='button' size='sm' disabled={disabled} className='h-7 px-2.5 text-[11px]' onClick={onPick}>
      Pick
    </Button>
  );
}
