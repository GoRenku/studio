import { Button } from '@/ui/button';

export function DirectionRevertButton(input: { onRevert: () => void }) {
  return (
    <Button
      type='button'
      variant='ghost'
      className='h-auto rounded-md bg-transparent px-1.5 py-1 text-[11.5px] font-normal text-[var(--dd-muted-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)]'
      onClick={input.onRevert}
    >
      Revert
    </Button>
  );
}
