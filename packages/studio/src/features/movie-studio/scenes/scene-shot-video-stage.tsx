import { Film, Play } from 'lucide-react';
import { Button } from '@/ui/button';
import { Slider } from '@/ui/slider';

export function SceneShotVideoStage() {
  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border/40 bg-black/80'>
        <div className='flex h-full flex-col items-center justify-center text-center'>
          <span className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/70'>
            <Film className='h-5 w-5' />
          </span>
          <p className='text-sm font-medium text-white/80'>No shot video yet</p>
        </div>
      </div>
      <SceneShotTransport />
    </div>
  );
}

function SceneShotTransport() {
  return (
    <div className='flex items-center gap-3'>
      <Button
        type='button'
        size='icon'
        variant='ghost'
        disabled
        aria-label='Play shot'
        className='h-8 w-8 shrink-0'
      >
        <Play className='h-4 w-4' />
      </Button>
      <Slider
        aria-label='Shot timeline'
        value={[0]}
        min={0}
        max={100}
        disabled
        className='flex-1'
      />
      <span className='shrink-0 font-mono text-xs tabular-nums text-muted-foreground'>
        0:00 / 0:00
      </span>
    </div>
  );
}
