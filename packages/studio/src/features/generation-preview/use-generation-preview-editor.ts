import { useRef, useState } from 'react';
import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
  GenerationPreviewResource,
  GenerationPreviewReferenceSlot,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import { updateGenerationPreviewResource } from '@/services/studio-generation-preview-api';
import {
  buildGenerationPreviewUpdateRequest,
  changeGenerationPreviewModel,
  changeGenerationPreviewParameter,
  createGenerationPreviewDraft,
  generationPreviewDraftIsDirty,
  changeGenerationPreviewReference,
  type GenerationPreviewDraft,
} from './generation-preview-draft';

export interface GenerationPreviewEditorSession {
  projectName: string;
  preview: GenerationPreviewResource;
  eventId: string;
}

export function useGenerationPreviewEditor(
  session: GenerationPreviewEditorSession,
) {
  const [preview, setPreview] = useState<GenerationPreviewResource>(session.preview);
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

  const chooseReference = (
    slot: GenerationPreviewReferenceSlot,
    reference: GenerationPreviewResourceReference | null
  ) => {
    if (!preview.generationSpecId || updatePending) {
      return;
    }
    setDraft((current) => changeGenerationPreviewReference(current, slot, reference));
    setUpdateError(null);
  };

  const chooseModel = (modelKey: string) => {
    if (!preview.generationSpecId || updatePending) {
      return;
    }
    const model = preview.authoring.models.find(
      (candidate) =>
        `${candidate.provider}/${candidate.modelId}` === modelKey
    );
    if (!model) {
      return;
    }
    setDraft((current) => changeGenerationPreviewModel(current, model));
    setUpdateError(null);
  };

  const chooseParameter = (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => {
    if (!preview.generationSpecId || updatePending) {
      return;
    }
    setDraft((current) =>
      changeGenerationPreviewParameter(current, controlId, value)
    );
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
      const nextPreview = await updateGenerationPreviewResource({
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

  const modelKey = `${draft.model.provider}/${draft.model.modelId}`;
  const selectedModel = preview.authoring.models.find(
    (model) =>
      model.provider === draft.model.provider &&
      model.modelId === draft.model.modelId
  );
  const controls: GenerationEditorControl[] = (selectedModel?.controls ?? [])
    .map((control) => {
      if (control.kind === 'readonly') {
        return control;
      }
      return {
        ...control,
        value: draft.parameterValues[control.controlId] ?? control.value,
      } as GenerationEditorControl;
    });

  return {
    preview,
    draft,
    editorRevision,
    updatePending,
    updateError,
    updateDirty: generationPreviewDraftIsDirty(preview, draft),
    modelKey,
    controls,
    updateAuthoredText,
    updateNegativeText,
    chooseReference,
    chooseModel,
    chooseParameter,
    update,
  };
}
