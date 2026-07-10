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
import { GenerationPreviewEstimateFooter } from './generation-preview-estimate-footer';
import type { GenerationPreviewDraft } from './generation-preview-draft';

interface GenerationPreviewDialogProps {
  open: boolean;
  preview: StudioGenerationPreview | null;
  draft: GenerationPreviewDraft | null;
  editorRevision: number;
  updatePending: boolean;
  updateDirty: boolean;
  updateError: string | null;
  onOpenChange: (open: boolean) => void;
  onAuthoredTextChange: (value: string) => void;
  onNegativeTextChange: (value: string) => void;
  onReferenceToggle: (reference: StudioGenerationPreviewReference) => void;
  onUpdate: () => void;
}

export function GenerationPreviewDialog({
  open,
  preview,
  draft,
  editorRevision,
  updatePending,
  updateDirty,
  updateError,
  onOpenChange,
  onAuthoredTextChange,
  onNegativeTextChange,
  onReferenceToggle,
  onUpdate,
}: GenerationPreviewDialogProps) {
  const [tab, setTab] = useState<GenerationPreviewTab>('prompt');

  return (
    <Dialog open={open && Boolean(preview)} onOpenChange={onOpenChange}>
      <DialogContent className='h-[720px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'>
        {preview && draft ? (
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
              draft={draft}
              editorRevision={editorRevision}
              tab={tab}
              updateError={updateError}
              updating={updatePending}
              onTabChange={setTab}
              onAuthoredTextChange={onAuthoredTextChange}
              onNegativeTextChange={onNegativeTextChange}
              onReferenceToggle={onReferenceToggle}
            />
            <DialogFooter className='items-end gap-4'>
              <div className='mr-auto min-w-0'>
                <GenerationPreviewEstimateFooter preview={preview} />
              </div>
              {preview.generationSpecId ? (
                <Button
                  onClick={onUpdate}
                  disabled={!updateDirty || updatePending}
                >
                  {updatePending ? 'Updating...' : 'Update'}
                </Button>
              ) : null}
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
