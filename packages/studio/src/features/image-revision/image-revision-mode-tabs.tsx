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
      variant='line'
      className='!h-[45px] w-full justify-start gap-0 rounded-none border-b border-border/40 bg-panel-bg px-4 py-0'
    >
      <TabsTrigger
        value='regenerate'
        disabled={!regenerateAvailable || disabled}
        className='h-full flex-none rounded-none border-0 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] data-[state=active]:after:bg-primary'
      >
        Regenerate
      </TabsTrigger>
      <TabsTrigger
        value='edit'
        disabled={disabled}
        className='h-full flex-none rounded-none border-0 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] data-[state=active]:after:bg-primary'
      >
        Edit
      </TabsTrigger>
      {!regenerateAvailable && regenerateUnavailableReason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='ml-auto flex h-full cursor-help items-center text-xs text-muted-foreground'>
              Regenerate unavailable
            </span>
          </TooltipTrigger>
          <TooltipContent>{regenerateUnavailableReason}</TooltipContent>
        </Tooltip>
      ) : null}
    </TabsList>
  );
}
