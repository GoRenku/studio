import { useEffect, useState } from 'react';
import { MediaGenerationPreviewDialog, type MediaGenerationPreviewSession } from './media-generation-preview-dialog';

export function MediaGenerationPreviewDialogHost() {
  const [session, setSession] = useState<MediaGenerationPreviewSession | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<MediaGenerationPreviewSession>).detail;
      if (!detail?.previews?.length) return;
      setSession(detail);
      setOpen(true);
    };
    window.addEventListener('renku:generation-preview-requested', handlePreview);
    return () => window.removeEventListener('renku:generation-preview-requested', handlePreview);
  }, []);

  return session ? (
    <MediaGenerationPreviewDialog key={session.eventId} open={open} session={session} onOpenChange={setOpen} />
  ) : null;
}
