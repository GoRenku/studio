import { useState } from 'react';
import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { generationPreviewTitle } from './generation-preview-title';
import {
  GenerationPreviewTabs,
  type GenerationPreviewTab,
} from './generation-preview-tabs';

interface GenerationPreviewDialogProps {
  open: boolean;
  preview: StudioGenerationPreview | null;
  updateError: string | null;
  updatingDependencyId: string | null;
  onOpenChange: (open: boolean) => void;
  onReferenceToggle: (reference: StudioGenerationPreviewReference) => void;
}

export function GenerationPreviewDialog({
  open,
  preview,
  updateError,
  updatingDependencyId,
  onOpenChange,
  onReferenceToggle,
}: GenerationPreviewDialogProps) {
  const [tab, setTab] = useState<GenerationPreviewTab>('prompt');

  return (
    <Dialog open={open && Boolean(preview)} onOpenChange={onOpenChange}>
      <DialogContent className='h-[720px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'>
        {preview ? (
          <>
            <DialogHeader className='pr-12'>
              <DialogTitle>{generationPreviewTitle(preview.purpose)}</DialogTitle>
              <DialogDescription className='sr-only'>
                Review the generation prompt, references, configuration, and
                diagnostics before generation.
              </DialogDescription>
            </DialogHeader>
            <GenerationPreviewTabs
              preview={preview}
              tab={tab}
              updateError={updateError}
              updatingDependencyId={updatingDependencyId}
              onTabChange={setTab}
              onReferenceToggle={onReferenceToggle}
            />
            <DialogFooter>
              <Button variant='outline' onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
