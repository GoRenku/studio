import { Film } from 'lucide-react';
import { Button } from '@/ui/button';
import { VideoPlayer } from '@/ui/video-player';
import type { SceneShotVideoTakeVideoWithHttp } from '@/services/studio-shot-video-takes-api';

interface SceneShotVideoStageProps {
  video?: SceneShotVideoTakeVideoWithHttp | null;
}

export function SceneShotVideoStage({
  video,
}: SceneShotVideoStageProps) {
  if (video) {
    return (
      <VideoPlayer
        src={video.url}
        title='Shot video take'
        className='h-full w-full object-contain'
      />
    );
  }
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
      <div className='flex items-center gap-3'>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          disabled
          aria-label='Play shot'
          className='h-8 w-8 shrink-0'
        >
          <Film data-icon='inline-start' />
        </Button>
        <div className='h-2 flex-1 rounded-full bg-muted' />
        <span className='shrink-0 font-mono text-xs tabular-nums text-muted-foreground'>
          0:00 / 0:00
        </span>
      </div>
    </div>
  );
}
