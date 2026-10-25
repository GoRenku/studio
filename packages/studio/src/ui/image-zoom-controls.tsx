import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import type { ImageZoom } from '@/ui/image-zoom';

interface ImageZoomControlsProps {
  zoom: Pick<ImageZoom, 'layout' | 'label' | 'zoomedIn' | 'canZoomIn' | 'zoomIn' | 'zoomOut' | 'reset' | 'actualPixels'>;
  className?: string;
}

const ZOOM_BUTTON = 'h-7 rounded-md px-2 text-xs text-foreground hover:bg-item-hover-bg';

/** Zoom out, the current zoom (which fits the image again when clicked), zoom in, and actual pixels. */
export function ImageZoomControls({ zoom, className }: ImageZoomControlsProps) {
  const ready = zoom.layout !== null;
  return (
    <div
      role='toolbar'
      aria-label='Zoom'
      className={cn('flex items-center gap-0.5 rounded-lg border border-panel-border bg-panel-bg/90 p-1 shadow-md backdrop-blur-sm', className)}
    >
      <Button type='button' variant='ghost' size='icon' aria-label='Zoom out' title='Zoom out' disabled={!ready || !zoom.zoomedIn} className={cn(ZOOM_BUTTON, 'w-7 px-0')} onClick={zoom.zoomOut}>
        <Minus className='h-3.5 w-3.5' />
      </Button>
      <Button type='button' variant='ghost' aria-label='Fit to view' title='Fit to view' disabled={!ready} className={cn(ZOOM_BUTTON, 'min-w-[3.25rem] font-mono tabular-nums')} onClick={zoom.reset}>
        {zoom.label}
      </Button>
      <Button type='button' variant='ghost' size='icon' aria-label='Zoom in' title='Zoom in' disabled={!ready || !zoom.canZoomIn} className={cn(ZOOM_BUTTON, 'w-7 px-0')} onClick={zoom.zoomIn}>
        <Plus className='h-3.5 w-3.5' />
      </Button>
      <span aria-hidden='true' className='mx-1 h-4 w-px bg-panel-border' />
      <Button type='button' variant='ghost' aria-label='Actual pixels' title='Actual pixels' disabled={!ready} className={cn(ZOOM_BUTTON, 'font-mono tabular-nums')} onClick={zoom.actualPixels}>
        100%
      </Button>
    </div>
  );
}
