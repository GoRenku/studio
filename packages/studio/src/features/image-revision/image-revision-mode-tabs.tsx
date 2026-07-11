import type { ImageRevisionMode } from '@gorenku/studio-core/client';
import { TabsList, TabsTrigger } from '@/ui/tabs';

interface ImageRevisionModeTabsProps {
  mode: ImageRevisionMode;
  regenerateAvailable: boolean;
  disabled: boolean;
}

export function ImageRevisionModeTabs({
  regenerateAvailable,
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
    </TabsList>
  );
}
