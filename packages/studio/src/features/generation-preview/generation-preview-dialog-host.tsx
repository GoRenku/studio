import { useEffect, useRef, useState } from 'react';
import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { updateGenerationPreviewSpec } from '@/services/studio-generation-preview-api';
import { GenerationPreviewDialog } from './generation-preview-dialog';
import {
  buildGenerationPreviewUpdateRequest,
  createGenerationPreviewDraft,
  generationPreviewDraftIsDirty,
  generationPreviewReferenceSelected,
  type GenerationPreviewDraft,
} from './generation-preview-draft';

interface GenerationPreviewEventDetail {
  projectName: string;
  preview: StudioGenerationPreview;
  eventId: string;
  createdAt: string;
}

interface GenerationPreviewDialogState {
  projectName: string;
  preview: StudioGenerationPreview;
  eventId: string;
  createdAt: string;
}

export function GenerationPreviewDialogHost() {
  const [state, setState] = useState<GenerationPreviewDialogState | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GenerationPreviewDraft | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [updatePending, setUpdatePending] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateRequestRevision = useRef(0);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<GenerationPreviewEventDetail>).detail;
      if (!detail?.preview) {
        return;
      }
      updateRequestRevision.current += 1;
      setState({
        projectName: detail.projectName,
        preview: detail.preview,
        eventId: detail.eventId,
        createdAt: detail.createdAt,
      });
      setDraft(createGenerationPreviewDraft(detail.preview));
      setEditorRevision((revision) => revision + 1);
      setUpdatePending(false);
      setUpdateError(null);
      setOpen(true);
    };
    window.addEventListener('renku:generation-preview-requested', handlePreview);
    return () =>
      window.removeEventListener(
        'renku:generation-preview-requested',
        handlePreview
      );
  }, []);

  const handleReferenceToggle = (
    reference: StudioGenerationPreviewReference,
  ) => {
    const control = reference.selectionControl;
    if (
      !state ||
      !draft ||
      !state.preview.generationSpecId ||
      !control?.editable ||
      control.required ||
      updatePending
    ) {
      return;
    }
    const selected = generationPreviewReferenceSelected(reference, draft);
    setDraft((current) =>
      current
        ? {
            ...current,
            referenceSelectionDraftByDependencyId: {
              ...current.referenceSelectionDraftByDependencyId,
              [control.dependencyId]: !selected,
            },
          }
        : current,
    );
    setUpdateError(null);
  };

  const handleUpdate = async () => {
    if (!state?.preview.generationSpecId || !draft || updatePending) {
      return;
    }
    const request = buildGenerationPreviewUpdateRequest(state.preview, draft);
    const requestRevision = updateRequestRevision.current + 1;
    updateRequestRevision.current = requestRevision;
    setUpdatePending(true);
    setUpdateError(null);
    try {
      const nextPreview = await updateGenerationPreviewSpec({
        projectName: state.projectName,
        specId: state.preview.generationSpecId,
        ...request,
      });
      if (updateRequestRevision.current !== requestRevision) {
        return;
      }
      setState((current) =>
        current
          ? {
              ...current,
              preview: nextPreview,
              createdAt: new Date().toISOString(),
            }
          : current
      );
      setDraft(createGenerationPreviewDraft(nextPreview));
      setEditorRevision((revision) => revision + 1);
    } catch (error) {
      if (updateRequestRevision.current === requestRevision) {
        setUpdateError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (updateRequestRevision.current === requestRevision) {
        setUpdatePending(false);
      }
    }
  };

  return (
    <GenerationPreviewDialog
      open={open && Boolean(state?.preview)}
      preview={state?.preview ?? null}
      draft={draft}
      editorRevision={editorRevision}
      updatePending={updatePending}
      updateDirty={
        state && draft
          ? generationPreviewDraftIsDirty(state.preview, draft)
          : false
      }
      updateError={updateError}
      onOpenChange={setOpen}
      onAuthoredTextChange={(authoredText) => {
        setDraft((current) =>
          current
            ? {
                ...current,
                promptDraft: { ...current.promptDraft, authoredText },
              }
            : current,
        );
        setUpdateError(null);
      }}
      onNegativeTextChange={(negativeText) => {
        setDraft((current) =>
          current
            ? {
                ...current,
                promptDraft: { ...current.promptDraft, negativeText },
              }
            : current,
        );
        setUpdateError(null);
      }}
      onReferenceToggle={handleReferenceToggle}
      onUpdate={handleUpdate}
    />
  );
}
