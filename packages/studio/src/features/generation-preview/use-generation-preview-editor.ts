import { useRef, useState } from 'react';
import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
  GenerationPreviewResource,
  GenerationPreviewReferenceSlot,
  GenerationPreviewResourceReference,
  ShotPlanVideoInputMode,
} from '@gorenku/studio-core/client';
import { updateGenerationPreviewResource } from '@/services/studio-generation-preview-api';
import {
  buildGenerationPreviewUpdateRequest,
  changeGenerationPreviewModel,
  changeGenerationPreviewParameter,
  createGenerationPreviewDraft,
  generationPreviewDraftIsDirty,
  changeGenerationPreviewReference,
  changeGenerationPreviewInputMode,
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
    if (preview.generationSpec?.frozenAt !== null || updatePending) {
      return;
    }
    setDraft((current) => changeGenerationPreviewReference(current, slot, reference));
    setUpdateError(null);
  };

  const chooseModel = (modelKey: string) => {
    if (preview.generationSpec?.frozenAt !== null || updatePending) {
      return;
    }
    if (preview.authoring.kind === 'none') {
      return;
    }
    const authoring = preview.authoring;
    const family = authoring.modelFamilies.find(
      (candidate) => candidate.familyId === modelKey
    );
    if (!family) {
      return;
    }
    setDraft((current) => changeGenerationPreviewModel(
      current,
      family.familyId,
      family.familyId === authoring.selectedModelFamilyId
        ? authoring.controls
        : [],
    ));
    setUpdateError(null);
  };

  const chooseInputMode = (inputMode: ShotPlanVideoInputMode) => {
    if (
      preview.authoring.kind !== 'video'
      || preview.generationSpec?.frozenAt !== null
      || updatePending
    ) {
      return;
    }
    setDraft((current) =>
      changeGenerationPreviewInputMode(current, inputMode)
    );
    setUpdateError(null);
  };

  const chooseParameter = (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => {
    if (preview.generationSpec?.frozenAt !== null || updatePending) {
      return;
    }
    setDraft((current) =>
      changeGenerationPreviewParameter(current, controlId, value)
    );
    setUpdateError(null);
  };

  const update = async () => {
    if (preview.generationSpec?.frozenAt !== null || updatePending) {
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
        specId: preview.generationSpec.id,
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

  const modelKey = draft.modelFamilyId;
  const controls: GenerationEditorControl[] = (
    preview.authoring.kind !== 'none'
    && draft.modelFamilyId === preview.authoring.selectedModelFamilyId
      ? preview.authoring.controls
      : []
  )
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
    chooseInputMode,
    chooseParameter,
    update,
  };
}
