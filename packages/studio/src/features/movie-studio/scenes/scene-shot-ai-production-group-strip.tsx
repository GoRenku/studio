import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export interface GroupStripItem {
  shotId: string;
  label: string;
}

interface SceneShotAiProductionGroupStripProps {
  items: GroupStripItem[];
  selectedShotId: string | null;
  onSelectShot?: (shotId: string) => void;
}

/**
 * Compact strip showing which shots share the current AI Production settings
 * (0041). Shows only the current group with meaningful labels, never raw ids.
 */
export function SceneShotAiProductionGroupStrip({
  items,
  selectedShotId,
  onSelectShot,
}: SceneShotAiProductionGroupStripProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {items.map((item) => (
        <Button
          key={item.shotId}
          type='button'
          variant='ghost'
          size='sm'
          disabled={!onSelectShot}
          onClick={onSelectShot ? () => onSelectShot(item.shotId) : undefined}
          className={cn(
            'h-6 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
            item.shotId === selectedShotId
              ? 'border-primary/45 bg-primary/12 text-foreground'
              : 'border-border/45 bg-muted/50 text-muted-foreground'
          )}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
