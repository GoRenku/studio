import { useState } from 'react';
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
  GenerationRequestEditor,
  type GenerationRequestEditorTab,
} from '@/features/generation-request-editor/generation-request-editor';
import { GenerationPreviewEstimateFooter } from './generation-preview-estimate-footer';
import {
  useGenerationPreviewEditor,
  type GenerationPreviewEditorSession,
} from './use-generation-preview-editor';

interface GenerationPreviewDialogProps {
  open: boolean;
  session: GenerationPreviewEditorSession;
  onOpenChange: (open: boolean) => void;
}

export function GenerationPreviewDialog({
  open,
  session,
  onOpenChange,
}: GenerationPreviewDialogProps) {
  const [tab, setTab] = useState<GenerationRequestEditorTab>('prompt');
  const editor = useGenerationPreviewEditor(session);
  const { preview, draft } = editor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='h-[720px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'>
        <>
            <DialogHeader className='pr-12'>
              <DialogTitle>{generationPreviewTitle(preview.purpose)}</DialogTitle>
              <DialogDescription className='sr-only'>
                Review the generation prompt, references, configuration, and
                diagnostics before generation.
              </DialogDescription>
            </DialogHeader>
            <GenerationRequestEditor
              preview={preview}
              draft={draft}
              editorRevision={editor.editorRevision}
              tab={tab}
              error={editor.updateError}
              errorTitle='Preview Update Failed'
              pending={editor.updatePending}
              readOnly={!preview.generationSpecId}
              onTabChange={setTab}
              onAuthoredTextChange={editor.updateAuthoredText}
              onNegativeTextChange={editor.updateNegativeText}
              onReferenceToggle={editor.toggleReference}
            />
            <DialogFooter className='items-end gap-4'>
              <div className='mr-auto min-w-0'>
                <GenerationPreviewEstimateFooter preview={preview} />
              </div>
              {preview.generationSpecId ? (
                <Button
                  onClick={editor.update}
                  disabled={!editor.updateDirty || editor.updatePending}
                >
                  {editor.updatePending ? 'Updating...' : 'Update'}
                </Button>
              ) : null}
              <Button variant='outline' onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
        </>
      </DialogContent>
    </Dialog>
  );
}
