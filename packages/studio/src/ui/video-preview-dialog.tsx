import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { VideoPlayer } from './video-player';

export function VideoPreviewDialog({
  open,
  onOpenChange,
  src,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='h-[min(760px,calc(100vh-6rem))] w-[min(1120px,calc(100vw-6rem))] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className='sr-only'>
            Video preview.
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 p-5'>
          <VideoPlayer
            src={src}
            title={title}
            className='h-full w-full object-contain'
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
