import { ArrowLeftRight, Eraser, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/ui/button';

const TOOL_BUTTON = 'h-auto gap-1.5 rounded-lg border border-[var(--dd-border)] bg-[var(--dd-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--dd-fg)] shadow-none hover:bg-[var(--dd-hover)] hover:text-[var(--dd-fg)] disabled:opacity-50';

export function ImageEditStageToolbar(input: {
  onEditBase: boolean;
  canDraw: boolean;
  regionsHidden: boolean;
  hasRegions: boolean;
  comparison: { parentTakeNumber: number; active: boolean } | null;
  onToggleRegions: () => void;
  onClearRegions: () => void;
  onToggleComparison: () => void;
}) {
  const hint = input.comparison?.active ? 'Drag across the image to compare' : input.canDraw ? 'Drag on the image to mark a region' : '';
  return (
    <div className='flex min-h-[45px] flex-wrap items-center gap-2 border-b border-[var(--dd-border)] bg-[var(--dd-bg)] px-3 py-2'>
      <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{hint}</span>
      <span className='flex-1' />
      {input.comparison ? (
        <Button type='button' variant='ghost' aria-pressed={input.comparison.active} onClick={input.onToggleComparison} className={TOOL_BUTTON}>
          <ArrowLeftRight className='size-3.5' />{input.comparison.active ? 'Hide comparison' : `Compare with Take ${input.comparison.parentTakeNumber}`}
        </Button>
      ) : null}
      {input.onEditBase ? (
        <>
          <Button type='button' variant='ghost' aria-pressed={input.regionsHidden} disabled={input.comparison?.active} onClick={input.onToggleRegions} className={TOOL_BUTTON}>
            {input.regionsHidden ? <Eye className='size-3.5' /> : <EyeOff className='size-3.5' />}{input.regionsHidden ? 'Show regions' : 'Hide regions'}
            <kbd className='rounded border border-[var(--dd-border)] px-1 font-mono text-[10px] text-[var(--dd-muted-fg)]'>H</kbd>
          </Button>
          <Button type='button' variant='ghost' disabled={!input.hasRegions || input.comparison?.active} onClick={input.onClearRegions} className={TOOL_BUTTON}>
            <Eraser className='size-3.5' />Clear regions
          </Button>
        </>
      ) : null}
    </div>
  );
}
