import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { Dialog, DialogContent } from '@/ui/dialog';
import type { GenerationRequestEditorTab } from '@/features/generation-request-editor/generation-request-editor';
import { GenerationPreviewRequestPanel } from './generation-preview-request-panel';

interface GenerationPreviewDialogSession {
  projectName: string;
  previews: import('@gorenku/studio-core/client').GenerationPreviewResource[];
  eventId: string;
}

interface GenerationPreviewDialogProps {
  open: boolean;
  session: GenerationPreviewDialogSession;
  onOpenChange: (open: boolean) => void;
}

export function GenerationPreviewDialog({
  open,
  session,
  onOpenChange,
}: GenerationPreviewDialogProps) {
  const [tab, setTab] = useState<GenerationRequestEditorTab>('prompt');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigation = session.previews.length > 1 ? (
    <div className='flex items-center gap-1'>
      <span className='mr-1 text-xs tabular-nums text-muted-foreground'>
        {activeIndex + 1} / {session.previews.length}
      </span>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-7 w-7'
        aria-label='Previous generation request'
        disabled={activeIndex === 0}
        onClick={() => setActiveIndex((index) => index - 1)}
      >
        <ChevronLeft className='h-4 w-4' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-7 w-7'
        aria-label='Next generation request'
        disabled={activeIndex === session.previews.length - 1}
        onClick={() => setActiveIndex((index) => index + 1)}
      >
        <ChevronRight className='h-4 w-4' />
      </Button>
    </div>
  ) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='generation-request-dialog h-[760px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'>
        {session.previews.map((preview, index) => (
          <GenerationPreviewRequestPanel
            key={`${session.eventId}:${preview.previewId}:${index}`}
            session={{
              projectName: session.projectName,
              preview,
              eventId: session.eventId,
            }}
            active={index === activeIndex}
            tab={tab}
            tabRowTrailing={index === activeIndex ? navigation : undefined}
            onTabChange={setTab}
            onClose={() => onOpenChange(false)}
          />
        ))}
      </DialogContent>
    </Dialog>
  );
}
