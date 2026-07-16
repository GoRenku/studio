import type {
  GenerationPreviewAuthoringModel,
  GenerationPreviewConfigurationValue,
  GenerationReferenceSlotSelectionInput,
  GenerationPreviewReferenceSlot,
  GenerationPreviewResource,
  GenerationPreviewResourceReference,
  JsonValue,
} from '@gorenku/studio-core/client';
import type { UpdateGenerationPreviewResourceSpecInput } from '@/services/studio-generation-preview-api';

export interface GenerationPreviewDraft {
  promptDraft: {
    authoredText: string;
    negativeText?: string;
  };
  model: {
    provider: string;
    modelId: string;
  };
  parameterValues: Record<string, GenerationPreviewConfigurationValue>;
  authoredParameterNames: string[];
  slotSelections: GenerationReferenceSlotSelectionInput[];
}

export function createGenerationPreviewDraft(
  preview: GenerationPreviewResource
): GenerationPreviewDraft {
  return {
    promptDraft: {
      authoredText: preview.finalPrompt.authoredText,
      ...(preview.finalPrompt.negativeText !== undefined
        ? { negativeText: preview.finalPrompt.negativeText }
        : {}),
    },
    model: {
      provider: preview.model.provider,
      modelId: preview.model.modelId,
    },
    ...parameterDraftForModel(
      preview.authoring.models.find((model) =>
        model.provider === preview.model.provider &&
        model.modelId === preview.model.modelId
      )
    ),
    slotSelections: [],
  };
}

export function generationPreviewReferenceSelected(
  slot: GenerationPreviewReferenceSlot,
  reference: GenerationPreviewResourceReference,
  draft: GenerationPreviewDraft
): boolean {
  const change = draft.slotSelections.find((candidate) =>
    placementKey(candidate.placement) === placementKey(slot.placement)
  );
  if (!change) {
    return slot.current?.assetId === reference.assetId &&
      slot.current.assetFileId === reference.assetFileId;
  }
  return change.reference?.kind === 'asset-file' &&
    change.reference.assetId === reference.assetId &&
    change.reference.assetFileId === reference.assetFileId;
}

export function changeGenerationPreviewReference(
  draft: GenerationPreviewDraft,
  slot: GenerationPreviewReferenceSlot,
  reference: GenerationPreviewResourceReference | null
): GenerationPreviewDraft {
  const key = placementKey(slot.placement);
  const slotSelections = draft.slotSelections.filter(
    (change) => placementKey(change.placement) !== key
  );
  slotSelections.push({
    placement: slot.placement,
    reference: reference
      ? {
          kind: 'asset-file',
          assetId: reference.assetId,
          assetFileId: reference.assetFileId,
        }
      : null,
    ...(reference?.providerToken
      ? { providerField: reference.providerToken }
      : {}),
  });
  return { ...draft, slotSelections };
}

export function generationPreviewDraftIsDirty(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): boolean {
  return draft.slotSelections.length > 0 ||
    draft.model.provider !== preview.model.provider ||
    draft.model.modelId !== preview.model.modelId ||
    !configurationValuesEqual(
      draft.parameterValues,
      parameterDraftForModel(
        preview.authoring.models.find((model) =>
          model.provider === preview.model.provider &&
          model.modelId === preview.model.modelId
        )
      ).parameterValues
    ) ||
    !stringCollectionsEqual(
      draft.authoredParameterNames,
      parameterDraftForModel(
        preview.authoring.models.find((model) =>
          model.provider === preview.model.provider &&
          model.modelId === preview.model.modelId
        )
      ).authoredParameterNames
    ) ||
    draft.promptDraft.authoredText !== preview.finalPrompt.authoredText ||
    draft.promptDraft.negativeText !== preview.finalPrompt.negativeText;
}

export function buildGenerationPreviewUpdateRequest(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): Pick<
  UpdateGenerationPreviewResourceSpecInput,
  'prompt' | 'model' | 'parameterValues' | 'slotSelections'
> {
  return {
    prompt: {
      authoredText: draft.promptDraft.authoredText,
      ...(preview.finalPrompt.negativeText !== undefined
        ? {
            negativeText: draft.promptDraft.negativeText === ''
              ? null
              : draft.promptDraft.negativeText ?? null,
          }
        : {}),
    },
    model: {
      provider: draft.model.provider,
      model: draft.model.modelId,
    },
    parameterValues: Object.fromEntries(
      draft.authoredParameterNames.map((name) => [
        name,
        draft.parameterValues[name] as JsonValue,
      ])
    ),
    slotSelections: draft.slotSelections,
  };
}

export function changeGenerationPreviewModel(
  draft: GenerationPreviewDraft,
  model: GenerationPreviewAuthoringModel,
): GenerationPreviewDraft {
  return {
    ...draft,
    model: {
      provider: model.provider,
      modelId: model.modelId,
    },
    ...parameterDraftForModel(model, true),
  };
}

export function changeGenerationPreviewParameter(
  draft: GenerationPreviewDraft,
  controlId: string,
  value: GenerationPreviewConfigurationValue,
): GenerationPreviewDraft {
  return {
    ...draft,
    parameterValues: {
      ...draft.parameterValues,
      [controlId]: value,
    },
    authoredParameterNames: draft.authoredParameterNames.includes(controlId)
      ? draft.authoredParameterNames
      : [...draft.authoredParameterNames, controlId],
  };
}

function parameterDraftForModel(
  model: GenerationPreviewAuthoringModel | undefined,
  modelSelection = false,
): Pick<GenerationPreviewDraft, 'parameterValues' | 'authoredParameterNames'> {
  const controls = (model?.controls ?? [])
      .filter((control) => control.kind !== 'readonly')
  return {
    parameterValues: Object.fromEntries(
      controls.map((control) => [control.controlId, control.value])
    ),
    authoredParameterNames: controls
      .filter((control) =>
        modelSelection ? control.recommended : control.authored
      )
      .map((control) => control.controlId),
  };
}

function configurationValuesEqual(
  left: Record<string, GenerationPreviewConfigurationValue>,
  right: Record<string, GenerationPreviewConfigurationValue>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stringCollectionsEqual(left: string[], right: string[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function placementKey(
  placement: GenerationPreviewReferenceSlot['placement']
): string {
  return [
    placement.sectionId,
    placement.slotId,
    placement.subject?.kind ?? '',
    placement.subject?.id ?? '',
  ].join(':');
}
