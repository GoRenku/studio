import { useRef, useState } from 'react';
import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { updateGenerationPreviewSpec } from '@/services/studio-generation-preview-api';
import {
  buildGenerationPreviewUpdateRequest,
  createGenerationPreviewDraft,
  generationPreviewDraftIsDirty,
  generationPreviewReferenceSelected,
  type GenerationPreviewDraft,
} from './generation-preview-draft';

export interface GenerationPreviewEditorSession {
  projectName: string;
  preview: StudioGenerationPreview;
  eventId: string;
}

export function useGenerationPreviewEditor(
  session: GenerationPreviewEditorSession,
) {
  const [preview, setPreview] = useState<StudioGenerationPreview>(session.preview);
  const [draft, setDraft] = useState<GenerationPreviewDraft>(() =>
    createGenerationPreviewDraft(session.preview),
  );
  const [editorRevision, setEditorRevision] = useState(0);
  const [updatePending, setUpdatePending] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const requestRevision = useRef(0);

  const updateAuthoredText = (authoredText: string) => {
    setDraft((current) => ({
      ...current,
      promptDraft: { ...current.promptDraft, authoredText },
    }));
    setUpdateError(null);
  };

  const updateNegativeText = (negativeText: string) => {
    setDraft((current) => ({
      ...current,
      promptDraft: { ...current.promptDraft, negativeText },
    }));
    setUpdateError(null);
  };

  const toggleReference = (reference: StudioGenerationPreviewReference) => {
    const control = reference.selectionControl;
    if (
      !preview.generationSpecId ||
      !control?.editable ||
      control.required ||
      updatePending
    ) {
      return;
    }
    const selected = generationPreviewReferenceSelected(reference, draft);
    setDraft((current) => ({
      ...current,
      referenceSelectionDraftByDependencyId: {
        ...current.referenceSelectionDraftByDependencyId,
        [control.dependencyId]: !selected,
      },
    }));
    setUpdateError(null);
  };

  const update = async () => {
    if (!preview.generationSpecId || updatePending) {
      return;
    }
    const request = buildGenerationPreviewUpdateRequest(preview, draft);
    const currentRevision = requestRevision.current + 1;
    requestRevision.current = currentRevision;
    setUpdatePending(true);
    setUpdateError(null);
    try {
      const nextPreview = await updateGenerationPreviewSpec({
        projectName: session.projectName,
        specId: preview.generationSpecId,
        ...request,
      });
      if (requestRevision.current !== currentRevision) {
        return;
      }
      setPreview(nextPreview);
      setDraft(createGenerationPreviewDraft(nextPreview));
      setEditorRevision((revision) => revision + 1);
    } catch (error) {
      if (requestRevision.current === currentRevision) {
        setUpdateError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (requestRevision.current === currentRevision) {
        setUpdatePending(false);
      }
    }
  };

  return {
    preview,
    draft,
    editorRevision,
    updatePending,
    updateError,
    updateDirty: generationPreviewDraftIsDirty(preview, draft),
    updateAuthoredText,
    updateNegativeText,
    toggleReference,
    update,
  };
}
