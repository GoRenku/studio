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
import { GenerationRequestEstimate } from '@/features/generation-request-editor/generation-request-estimate';
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
      <DialogHeader className='h-[54px] justify-center py-0 pr-12'>
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
        readOnly={!preview.generationSpec || preview.generationSpec.frozenAt !== null}
        tabRowTrailing={tabRowTrailing}
        onTabChange={onTabChange}
        onAuthoredTextChange={editor.updateAuthoredText}
        onNegativeTextChange={editor.updateNegativeText}
        onReferenceChoose={editor.chooseReference}
        controls={editor.controls}
        modelControl={preview.authoring.modelFamilies.length > 0
          ? {
              value: editor.modelKey,
              options: preview.authoring.modelFamilies.map((family) => ({
                value: family.familyId,
                label: family.label,
              })),
            }
          : undefined}
        onModelChange={editor.chooseModel}
        onControlChange={editor.chooseParameter}
      />
      <DialogFooter className='items-end gap-4'>
        <div className='mr-auto min-w-0'>
          <GenerationRequestEstimate estimate={preview.estimate} />
        </div>
        {preview.generationSpec?.frozenAt === null ? (
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
