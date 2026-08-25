import { useState } from 'react';
import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { updateMediaGenerationPreview } from './media-generation-preview-api';
import { MediaGenerationRequestDialog } from './media-generation-request-dialog';
import type { MediaGenerationRequestTab } from './media-generation-request-view';

export interface MediaGenerationPreviewSession {
  projectName: string;
  previews: MediaGenerationPreviewResource[];
  eventId: string;
}

export function MediaGenerationPreviewDialog({
  open,
  session,
  onOpenChange,
}: {
  open: boolean;
  session: MediaGenerationPreviewSession;
  onOpenChange: (open: boolean) => void;
}) {
  const [previews, setPreviews] = useState(session.previews);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<MediaGenerationRequestTab>('prompt');
  const [prompts, setPrompts] = useState(() => session.previews.map((entry) => entry.prompt));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = previews[activeIndex];

  if (!preview) return null;
  const prompt = prompts[activeIndex] ?? preview.prompt;
  const dirty = prompt !== preview.prompt;
  const navigate = (nextIndex: number) => {
    setActiveIndex(nextIndex);
    setError(null);
  };
  const navigation = previews.length > 1 ? (
    <div className='flex items-center gap-1'>
      <span className='mr-1 text-xs tabular-nums text-muted-foreground'>{activeIndex + 1} / {previews.length}</span>
      <Button type='button' variant='ghost' size='icon' className='h-7 w-7' aria-label='Previous generation request' disabled={activeIndex === 0} onClick={() => navigate(activeIndex - 1)}>
        <ChevronLeft className='h-4 w-4' />
      </Button>
      <Button type='button' variant='ghost' size='icon' className='h-7 w-7' aria-label='Next generation request' disabled={activeIndex === previews.length - 1} onClick={() => navigate(activeIndex + 1)}>
        <ChevronRight className='h-4 w-4' />
      </Button>
    </div>
  ) : undefined;

  async function update(): Promise<void> {
    if (prompt === null || !preview.documentPath) return;
    setPending(true);
    setError(null);
    try {
      const updated = await updateMediaGenerationPreview({
        projectName: session.projectName,
        documentPath: preview.documentPath,
        prompt,
      });
      setPreviews((current) => current.map((entry, index) => index === activeIndex ? updated : entry));
      setPrompts((current) => current.map((entry, index) => index === activeIndex ? updated.prompt : entry));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <MediaGenerationRequestDialog
      open={open}
      onOpenChange={onOpenChange}
      preview={preview}
      prompt={prompt}
      tab={tab}
      onPromptChange={(value) => setPrompts((current) => current.map((entry, index) => index === activeIndex ? value : entry))}
      onTabChange={setTab}
      footerError={error}
      tabTrailing={navigation}
      updateAction={preview.editable ? {
        disabled: !dirty,
        pending,
        onUpdate: () => void update(),
      } : undefined}
    />
  );
}
