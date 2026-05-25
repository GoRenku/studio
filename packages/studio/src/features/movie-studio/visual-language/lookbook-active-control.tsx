import { Check, CircleDot } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

interface LookbookActiveControlProps {
  isActive: boolean;
  onToggleActive: () => Promise<void>;
}

export function LookbookActiveControl({
  isActive,
  onToggleActive,
}: LookbookActiveControlProps) {
  const label = isActive ? 'Clear active lookbook' : 'Set active lookbook';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant={isActive ? 'default' : 'ghost'}
          className={
            isActive
              ? 'h-8 w-8 rounded-full border border-primary/80 bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,0,0,0.28)] hover:bg-primary/90'
              : 'h-8 w-8 rounded-full border border-white/22 bg-black/32 text-white/76 shadow-[0_8px_18px_rgba(0,0,0,0.2)] backdrop-blur-sm hover:bg-white/16 hover:text-white'
          }
          aria-label={label}
          aria-pressed={isActive}
          onClick={(event) => {
            const button = event.currentTarget;
            void onToggleActive().finally(() => button.blur());
          }}
        >
          {isActive ? <Check className='h-4 w-4' /> : <CircleDot className='h-4 w-4' />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top'>{label}</TooltipContent>
    </Tooltip>
  );
}
