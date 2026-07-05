import { Check, CircleDot } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

export const IMAGE_SELECTION_CONTROL_CLASS = 'h-7 w-7 rounded-full';
export const IMAGE_SELECTION_CONTROL_ICON_CLASS = 'h-3.5 w-3.5';

interface ImageSelectionControlProps {
  selected: boolean;
  selectedLabel: string;
  unselectedLabel: string;
  disabled?: boolean;
  busy?: boolean;
  onToggleSelected: () => Promise<void>;
}

export function ImageSelectionControl({
  selected,
  selectedLabel,
  unselectedLabel,
  disabled = false,
  busy = false,
  onToggleSelected,
}: ImageSelectionControlProps) {
  const label = busy ? 'Updating reference selection' : selected ? selectedLabel : unselectedLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant={selected ? 'default' : 'ghost'}
          className={
            selected
              ? `${IMAGE_SELECTION_CONTROL_CLASS} border border-primary/80 bg-primary text-primary-foreground shadow-[0_5px_12px_rgba(0,0,0,0.22)] hover:bg-primary/90`
              : `${IMAGE_SELECTION_CONTROL_CLASS} border border-white/22 bg-black/32 text-white/76 shadow-[0_5px_12px_rgba(0,0,0,0.16)] backdrop-blur-sm hover:bg-white/16 hover:text-white`
          }
          aria-label={label}
          aria-pressed={selected}
          disabled={disabled || busy}
          onClick={(event) => {
            const button = event.currentTarget;
            void onToggleSelected().finally(() => button.blur());
          }}
        >
          {selected ? (
            <Check className={IMAGE_SELECTION_CONTROL_ICON_CLASS} />
          ) : (
            <CircleDot className={IMAGE_SELECTION_CONTROL_ICON_CLASS} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  );
}
