import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  GenerationEditorControl,
  ImageRevisionDraft,
} from '@gorenku/studio-core/client';
import { GenerationRequestEditor } from '@/features/generation-request-editor/generation-request-editor';
import type { GenerationRequestEditorTab } from '@/features/generation-request-editor/generation-request-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Tabs } from '@/ui/tabs';
import { ImageRevisionDialogFooter } from './image-revision-dialog-footer';
import { ImageRevisionModeTabs } from './image-revision-mode-tabs';
import {
  useImageRevisionEditor,
  type ImageRevisionEditorRequest,
} from './use-image-revision-editor';

interface ImageRevisionDialogProps {
  open: boolean;
  request: ImageRevisionEditorRequest;
  onOpenChange: (open: boolean) => void;
}

export function ImageRevisionDialog({
  open,
  request,
  onOpenChange,
}: ImageRevisionDialogProps) {
  const [editorTab, setEditorTab] =
    useState<GenerationRequestEditorTab>('prompt');
  const editor = useImageRevisionEditor(request, () => onOpenChange(false));
  const regenerateAvailable = editor.context?.regenerate.state === 'available';
  const regenerateUnavailableReason =
    editor.context?.regenerate.state === 'unavailable'
      ? editor.context.regenerate.diagnostics[0]?.message
      : undefined;
  const controls =
    editor.mode === 'edit' && editor.modeContext?.state === 'available'
      ? editor.modeContext.controls.map((control) =>
          applyDraftControlValue(control, editor.draft),
        )
      : [];
  const canRun = Boolean(
    editor.draft &&
      editor.modeContext?.state === 'available' &&
      !editor.loading,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && editor.runPending) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className='h-[760px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'
        onEscapeKeyDown={(event) => {
          if (editor.runPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (editor.runPending) event.preventDefault();
        }}
      >
        <DialogHeader className='pr-12'>
          <DialogTitle>
            {editor.context?.source.title
              ? `Revise ${editor.context.source.title}`
              : 'Revise Image'}
          </DialogTitle>
          <DialogDescription>
            Regenerate from the original request or describe a targeted image edit.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={editor.mode}
          onValueChange={(value) => editor.changeMode(value as never)}
          className='contents'
        >
          <ImageRevisionModeTabs
            regenerateAvailable={regenerateAvailable}
            regenerateUnavailableReason={regenerateUnavailableReason}
            disabled={editor.runPending}
          />
        </Tabs>
        {editor.loading || !editor.editorDraft ? (
          <div className='flex min-h-0 items-center justify-center bg-panel-bg text-sm text-muted-foreground'>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            Loading image revision...
          </div>
        ) : (
          <GenerationRequestEditor
            preview={editor.preview}
            draft={editor.editorDraft}
            editorRevision={editor.editorRevision}
            tab={editorTab}
            error={editor.error}
            errorTitle='Image Revision Failed'
            pending={editor.runPending}
            referencesReadOnly
            controls={controls}
            onTabChange={setEditorTab}
            onAuthoredTextChange={editor.updateAuthoredText}
            onNegativeTextChange={editor.updateNegativeText}
            onControlChange={editor.updateControl}
            authoredPlaceholder={
              editor.mode === 'edit'
                ? 'Describe the changes to make to this image.'
                : undefined
            }
          />
        )}
        <ImageRevisionDialogFooter
          mode={editor.mode}
          estimatedUsd={editor.estimatedUsd}
          estimatePending={editor.estimatePending}
          runPending={editor.runPending}
          canRun={canRun}
          onCancel={() => onOpenChange(false)}
          onRun={editor.run}
        />
      </DialogContent>
    </Dialog>
  );
}

function applyDraftControlValue(
  control: GenerationEditorControl,
  draft: ImageRevisionDraft | null,
): GenerationEditorControl {
  const draftValue = draft?.generationControls.find(
    (candidate) => candidate.controlId === control.controlId,
  )?.value;
  if (draftValue === undefined) return control;
  if (control.kind === 'number') {
    return typeof draftValue === 'number' || draftValue === null
      ? { ...control, value: draftValue }
      : control;
  }
  if (control.kind === 'toggle') {
    return typeof draftValue === 'boolean'
      ? { ...control, value: draftValue }
      : control;
  }
  if (control.kind === 'text') {
    return typeof draftValue === 'string' || draftValue === null
      ? { ...control, value: draftValue }
      : control;
  }
  return { ...control, value: draftValue };
}
