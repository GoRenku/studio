import type {
  GenerationPreviewReferenceChange,
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
  referenceChanges: GenerationPreviewReferenceChange[];
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
    referenceChanges: [],
  };
}

export function generationPreviewReferenceSelected(
  slot: GenerationPreviewReferenceSlot,
  reference: GenerationPreviewResourceReference,
  draft: GenerationPreviewDraft
): boolean {
  const change = draft.referenceChanges.find((candidate) =>
    placementKey(candidate.placement) === placementKey(slot.placement)
  );
  if (!change) {
    return reference.selected;
  }
  return change.kind === 'replace' &&
    change.reference.kind === 'asset-file' &&
    change.reference.assetId === reference.assetId &&
    change.reference.assetFileId === reference.assetFileId;
}

export function changeGenerationPreviewReference(
  draft: GenerationPreviewDraft,
  slot: GenerationPreviewReferenceSlot,
  reference: GenerationPreviewResourceReference | null
): GenerationPreviewDraft {
  const key = placementKey(slot.placement);
  const referenceChanges = draft.referenceChanges.filter(
    (change) => placementKey(change.placement) !== key
  );
  referenceChanges.push(reference
    ? {
        kind: 'replace',
        placement: slot.placement,
        reference: {
          kind: 'asset-file',
          assetId: reference.assetId,
          assetFileId: reference.assetFileId,
        },
      }
    : { kind: 'clear', placement: slot.placement });
  return { ...draft, referenceChanges };
}

export function generationPreviewDraftIsDirty(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): boolean {
  return draft.referenceChanges.length > 0 ||
    draft.promptDraft.authoredText !== preview.finalPrompt.authoredText ||
    draft.promptDraft.negativeText !== preview.finalPrompt.negativeText;
}

export function buildGenerationPreviewUpdateRequest(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): Pick<UpdateGenerationPreviewResourceSpecInput, 'prompt' | 'referenceChanges'> {
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
    referenceChanges: draft.referenceChanges,
  };
}

function placementKey(
  placement: GenerationPreviewReferenceSlot['placement']
): string {
  return [
    placement.sectionId,
    placement.slotId,
    placement.scope?.kind ?? '',
    placement.scope?.id ?? '',
    placement.subject?.kind ?? '',
    placement.subject?.id ?? '',
  ].join(':');
}
