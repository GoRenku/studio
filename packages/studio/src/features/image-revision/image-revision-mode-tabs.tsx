import { TabsList, TabsTrigger } from '@/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

interface ImageRevisionModeTabsProps {
  regenerateAvailable: boolean;
  regenerateUnavailableReason?: string;
  disabled: boolean;
}

export function ImageRevisionModeTabs({
  regenerateAvailable,
  regenerateUnavailableReason,
  disabled,
}: ImageRevisionModeTabsProps) {
  return (
    <TabsList
      className='ml-auto h-8 shrink-0 gap-0.5 rounded-md border border-border/60 bg-background/60 p-0.5'
    >
      <TabsTrigger
        value='regenerate'
        disabled={!regenerateAvailable || disabled}
        className='h-7 flex-none rounded px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]'
      >
        Regenerate
      </TabsTrigger>
      <TabsTrigger
        value='edit'
        disabled={disabled}
        className='h-7 flex-none rounded px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]'
      >
        Edit
      </TabsTrigger>
      {!regenerateAvailable && regenerateUnavailableReason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='sr-only cursor-help'>
              Why Regenerate is unavailable
            </span>
          </TooltipTrigger>
          <TooltipContent>{regenerateUnavailableReason}</TooltipContent>
        </Tooltip>
      ) : null}
    </TabsList>
  );
}
