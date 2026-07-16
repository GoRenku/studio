import type { ReactNode } from 'react';
import { Button } from '@/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import {
  GenerationRequestEditor,
  type GenerationRequestEditorTab,
} from '@/features/generation-request-editor/generation-request-editor';
import { GenerationPreviewEstimateFooter } from './generation-preview-estimate-footer';
import { generationPreviewTitle } from './generation-preview-title';
import {
  useGenerationPreviewEditor,
  type GenerationPreviewEditorSession,
} from './use-generation-preview-editor';

interface GenerationPreviewRequestPanelProps {
  session: GenerationPreviewEditorSession;
  active: boolean;
  tab: GenerationRequestEditorTab;
  tabRowTrailing?: ReactNode;
  onTabChange: (tab: GenerationRequestEditorTab) => void;
  onClose: () => void;
}

export function GenerationPreviewRequestPanel({
  session,
  active,
  tab,
  tabRowTrailing,
  onTabChange,
  onClose,
}: GenerationPreviewRequestPanelProps) {
  const editor = useGenerationPreviewEditor(session);
  const { preview, draft } = editor;

  if (!active) {
    return null;
  }

  return (
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
        referencesReadOnly={preview.purpose === 'image.edit'}
        tabRowTrailing={tabRowTrailing}
        onTabChange={onTabChange}
        onAuthoredTextChange={editor.updateAuthoredText}
        onNegativeTextChange={editor.updateNegativeText}
        onReferenceChoose={editor.chooseReference}
        controls={editor.controls}
        modelControl={{
          value: editor.modelKey,
          options: preview.authoring.models.map((model) => ({
            value: `${model.provider}/${model.modelId}`,
            label: `${model.label} — ${model.modelId}`,
          })),
        }}
        onModelChange={editor.chooseModel}
        onControlChange={editor.chooseParameter}
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
        <Button variant='outline' onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
