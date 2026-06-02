import type { ComponentType } from 'react';
import {
  Film,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Layers,
  Type,
  type LucideProps,
} from 'lucide-react';
import type { ShotVideoTakeIntentId } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';
import type { IntentOption } from './shot-video-take-production-projection';

const INTENT_ICONS: Partial<Record<ShotVideoTakeIntentId, ComponentType<LucideProps>>> = {
  'text-only': Type,
  'first-frame': ImageIcon,
  'first-last-frame': GalleryHorizontalEnd,
  reference: Layers,
  'multi-shot': Film,
};

interface SceneShotAiProductionIntentListProps {
  options: IntentOption[];
  selectedIntent: ShotVideoTakeIntentId | null;
  onSelectIntent: (intent: ShotVideoTakeIntentId) => void;
}

/**
 * Vertical intent rail (column 1 of the AI Production tab, 0041). Group-size
 * gating keeps disabled intents visible with a tooltip; no dependency counts.
 */
export function SceneShotAiProductionIntentList({
  options,
  selectedIntent,
  onSelectIntent,
}: SceneShotAiProductionIntentListProps) {
  return (
    <div className='flex flex-col gap-1'>
      <h4 className='px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Intent
      </h4>
      {options.map((option) => {
        const Icon = INTENT_ICONS[option.id] ?? Type;
        const selected = option.id === selectedIntent;
        const row = (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={!option.enabled}
            aria-pressed={selected}
            onClick={() => onSelectIntent(option.id)}
            className={cn(
              'w-full justify-start gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45',
              selected
                ? 'border-primary/60 bg-primary/12 text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-item-hover-bg hover:text-foreground'
            )}
          >
            <Icon
              data-icon='inline-start'
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                selected ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span className='truncate'>{option.label}</span>
          </Button>
        );
        if (option.disabledTooltip) {
          return (
            <Tooltip key={option.id}>
              <TooltipTrigger asChild>{row}</TooltipTrigger>
              <TooltipContent side='bottom'>{option.disabledTooltip}</TooltipContent>
            </Tooltip>
          );
        }
        return <div key={option.id}>{row}</div>;
      })}
    </div>
  );
}
