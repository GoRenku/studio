import type {
  GenerationReferenceSlotSelectionInput,
  GenerationPreviewReferenceSlot,
  GenerationPreviewResource,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import type { UpdateGenerationPreviewResourceSpecInput } from '@/services/studio-generation-preview-api';

export interface GenerationPreviewDraft {
  promptDraft: {
    authoredText: string;
    negativeText?: string;
  };
  slotSelections: GenerationReferenceSlotSelectionInput[];
  genericReferences: GenerationPreviewResourceReference[];
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
    slotSelections: [],
    genericReferences: preview.references.additional,
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
    !referenceCollectionsEqual(draft.genericReferences, preview.references.additional) ||
    draft.promptDraft.authoredText !== preview.finalPrompt.authoredText ||
    draft.promptDraft.negativeText !== preview.finalPrompt.negativeText;
}

export function buildGenerationPreviewUpdateRequest(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): Pick<UpdateGenerationPreviewResourceSpecInput, 'prompt' | 'slotSelections' | 'genericReferences'> {
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
    slotSelections: draft.slotSelections,
    genericReferences: draft.genericReferences.map((reference) => ({
      kind: 'asset-file',
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
    })),
  };
}

function referenceCollectionsEqual(
  left: GenerationPreviewResourceReference[],
  right: GenerationPreviewResourceReference[],
): boolean {
  return left.length === right.length && left.every((reference, index) => {
    const candidate = right[index];
    return candidate?.assetId === reference.assetId &&
      candidate.assetFileId === reference.assetFileId;
  });
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
