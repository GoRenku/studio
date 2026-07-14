import { useEffect, useState } from 'react';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { GenerationPreviewDialog } from './generation-preview-dialog';

interface GenerationPreviewEventDetail {
  projectName: string;
  previews: GenerationPreviewResource[];
  eventId: string;
  createdAt: string;
}

export function GenerationPreviewDialogHost() {
  const [state, setState] = useState<GenerationPreviewEventDetail | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<GenerationPreviewEventDetail>).detail;
      if (!detail?.previews?.length) {
        return;
      }
      setState(detail);
      setOpen(true);
    };
    window.addEventListener('renku:generation-preview-requested', handlePreview);
    return () =>
      window.removeEventListener(
        'renku:generation-preview-requested',
        handlePreview
      );
  }, []);

  return state ? (
    <GenerationPreviewDialog
      key={state.eventId}
      open={open && state.previews.length > 0}
      session={state}
      onOpenChange={setOpen}
    />
  ) : null;
}
