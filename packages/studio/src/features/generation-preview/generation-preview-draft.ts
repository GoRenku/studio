import type {
  GenerationPreviewResource,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import type { UpdateGenerationPreviewResourceSpecInput } from '@/services/studio-generation-preview-api';

export interface GenerationPreviewDraft {
  promptDraft: {
    authoredText: string;
    negativeText?: string;
  };
  referenceSelectionDraftBySelectionId: Record<string, boolean>;
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
    referenceSelectionDraftBySelectionId: Object.fromEntries(
      preview.references.flatMap((reference) => {
        const selectionId = reference.selectionControl?.selectionId;
        return selectionId ? [[selectionId, reference.selected]] : [];
      })
    ),
  };
}

export function generationPreviewReferenceSelected(
  reference: GenerationPreviewResourceReference,
  draft: GenerationPreviewDraft
): boolean {
  if (reference.selectionControl?.required) {
    return true;
  }
  const selectionId = reference.selectionControl?.selectionId;
  return selectionId &&
    selectionId in draft.referenceSelectionDraftBySelectionId
    ? draft.referenceSelectionDraftBySelectionId[selectionId]!
    : reference.selected;
}

export function generationPreviewDraftIsDirty(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): boolean {
  if (
    draft.promptDraft.authoredText !== preview.finalPrompt.authoredText ||
    draft.promptDraft.negativeText !== preview.finalPrompt.negativeText
  ) {
    return true;
  }
  return preview.references.some(
    (reference) =>
      reference.selectionControl?.editable === true &&
      generationPreviewReferenceSelected(reference, draft) !==
        reference.selected
  );
}

export function buildGenerationPreviewUpdateRequest(
  preview: GenerationPreviewResource,
  draft: GenerationPreviewDraft
): Pick<
  UpdateGenerationPreviewResourceSpecInput,
  'prompt' | 'referenceSelections'
> {
  return {
    prompt: {
      authoredText: draft.promptDraft.authoredText,
      ...(preview.finalPrompt.negativeText !== undefined
        ? {
            negativeText:
              draft.promptDraft.negativeText === ''
                ? null
                : draft.promptDraft.negativeText ?? null,
          }
        : {}),
    },
    referenceSelections: preview.references.flatMap((reference) => {
      const control = reference.selectionControl;
      if (!control?.editable) {
        return [];
      }
      return [
        {
          selectionId: control.selectionId,
          selected: generationPreviewReferenceSelected(reference, draft),
        },
      ];
    }),
  };
}
