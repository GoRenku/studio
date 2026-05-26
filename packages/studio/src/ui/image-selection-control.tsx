import { Check, CircleDot } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

interface ImageSelectionControlProps {
  selected: boolean;
  selectedLabel: string;
  unselectedLabel: string;
  onToggleSelected: () => Promise<void>;
}

export function ImageSelectionControl({
  selected,
  selectedLabel,
  unselectedLabel,
  onToggleSelected,
}: ImageSelectionControlProps) {
  const label = selected ? selectedLabel : unselectedLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant={selected ? 'default' : 'ghost'}
          className={
            selected
              ? 'h-8 w-8 rounded-full border border-primary/80 bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,0,0,0.28)] hover:bg-primary/90'
              : 'h-8 w-8 rounded-full border border-white/22 bg-black/32 text-white/76 shadow-[0_8px_18px_rgba(0,0,0,0.2)] backdrop-blur-sm hover:bg-white/16 hover:text-white'
          }
          aria-label={label}
          aria-pressed={selected}
          onClick={(event) => {
            const button = event.currentTarget;
            void onToggleSelected().finally(() => button.blur());
          }}
        >
          {selected ? (
            <Check className='h-4 w-4' />
          ) : (
            <CircleDot className='h-4 w-4' />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  );
}
