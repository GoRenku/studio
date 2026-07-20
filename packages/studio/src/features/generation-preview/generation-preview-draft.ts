import type {
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
  modelFamilyId: string;
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
    modelFamilyId: preview.authoring.selectedModelFamilyId,
    ...parameterDraftForControls(preview.authoring.controls),
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
    return referenceIdentityEqual(slot.current?.identity, reference.identity);
  }
  return generationReferenceIdentityEqual(change.reference, reference.identity);
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
    reference: reference ? previewReferenceIdentity(reference.identity) : null,
  });
  return { ...draft, slotSelections };
}

function previewReferenceIdentity(
  identity: GenerationPreviewResourceReference['identity'],
): GenerationReferenceSlotSelectionInput['reference'] {
  if (identity.kind === 'project-file') {
    throw new Error('Project-file references are saved-request display values, not picker candidates.');
  }
  return identity;
}

function referenceIdentityEqual(
  left: GenerationPreviewResourceReference['identity'] | undefined,
  right: GenerationPreviewResourceReference['identity'],
): boolean {
  if (!left || left.kind !== right.kind) return false;
  return left.kind === 'project-file' ||
    (right.kind === 'asset-file' && left.assetId === right.assetId &&
      left.assetFileId === right.assetFileId);
}

function generationReferenceIdentityEqual(
  left: GenerationReferenceSlotSelectionInput['reference'],
  right: GenerationPreviewResourceReference['identity'],
): boolean {
  if (!left || left.kind !== right.kind) return false;
  return left.kind === 'project-file'
    ? right.kind === 'project-file'
    : right.kind === 'asset-file' && left.assetId === right.assetId &&
      left.assetFileId === right.assetFileId;
}

export function generationPreviewDraftIsDirty(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): boolean {
  return draft.slotSelections.length > 0 ||
    draft.modelFamilyId !== preview.authoring.selectedModelFamilyId ||
    !configurationValuesEqual(
      draft.parameterValues,
      parameterDraftForControls(preview.authoring.controls).parameterValues
    ) ||
    !stringCollectionsEqual(
      draft.authoredParameterNames,
      parameterDraftForControls(preview.authoring.controls).authoredParameterNames
    ) ||
    draft.promptDraft.authoredText !== preview.finalPrompt.authoredText ||
    draft.promptDraft.negativeText !== preview.finalPrompt.negativeText;
}

export function buildGenerationPreviewUpdateRequest(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): Pick<
  UpdateGenerationPreviewResourceSpecInput,
  'prompt' | 'modelFamilyId' | 'parameterValues' | 'slotSelections'
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
    modelFamilyId: draft.modelFamilyId,
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
  modelFamilyId: string,
  controls: GenerationPreviewResource['authoring']['controls'],
): GenerationPreviewDraft {
  return {
    ...draft,
    modelFamilyId,
    ...parameterDraftForControls(controls, true),
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

function parameterDraftForControls(
  inputControls: GenerationPreviewResource['authoring']['controls'],
  modelSelection = false,
): Pick<GenerationPreviewDraft, 'parameterValues' | 'authoredParameterNames'> {
  const controls = inputControls
    .filter((control) => control.kind !== 'readonly');
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
