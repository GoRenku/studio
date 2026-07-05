import { useEffect, useState } from 'react';
import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import { updateCastCharacterSheetPreviewReference } from '@/services/studio-generation-preview-api';
import { GenerationPreviewDialog } from './generation-preview-dialog';

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
  const [updatingDependencyId, setUpdatingDependencyId] = useState<string | null>(
    null
  );
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<GenerationPreviewEventDetail>).detail;
      if (!detail?.preview) {
        return;
      }
      setState({
        projectName: detail.projectName,
        preview: detail.preview,
        eventId: detail.eventId,
        createdAt: detail.createdAt,
      });
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

  const handleReferenceToggle = async (
    reference: StudioGenerationPreviewReference
  ) => {
    const control = reference.selectionControl;
    if (!state || !state.preview.generationSpecId || !control?.editable) {
      return;
    }
    const inclusion = reference.selected ? 'exclude' : 'include';
    setUpdatingDependencyId(control.dependencyId);
    setUpdateError(null);
    try {
      const nextPreview = await updateCastCharacterSheetPreviewReference({
        projectName: state.projectName,
        specId: state.preview.generationSpecId,
        dependencyId: control.dependencyId,
        inclusion,
      });
      setState((current) =>
        current
          ? {
              ...current,
              preview: nextPreview,
              createdAt: new Date().toISOString(),
            }
          : current
      );
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdatingDependencyId(null);
    }
  };

  return (
    <GenerationPreviewDialog
      open={open && Boolean(state?.preview)}
      preview={state?.preview ?? null}
      updateError={updateError}
      updatingDependencyId={updatingDependencyId}
      onOpenChange={setOpen}
      onReferenceToggle={handleReferenceToggle}
    />
  );
}
