import type {
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import type { UpdateStudioGenerationPreviewSpecInput } from '@/services/studio-generation-preview-api';

export interface GenerationPreviewDraft {
  promptDraft: {
    authoredText: string;
    negativeText?: string;
  };
  referenceSelectionDraftByDependencyId: Record<string, boolean>;
}

export function createGenerationPreviewDraft(
  preview: StudioGenerationPreview
): GenerationPreviewDraft {
  return {
    promptDraft: {
      authoredText: preview.finalPrompt.authoredText,
      ...(preview.finalPrompt.negativeText !== undefined
        ? { negativeText: preview.finalPrompt.negativeText }
        : {}),
    },
    referenceSelectionDraftByDependencyId: Object.fromEntries(
      preview.references.flatMap((reference) => {
        const dependencyId = reference.selectionControl?.dependencyId;
        return dependencyId ? [[dependencyId, reference.selected]] : [];
      })
    ),
  };
}

export function generationPreviewReferenceSelected(
  reference: StudioGenerationPreviewReference,
  draft: GenerationPreviewDraft
): boolean {
  if (reference.selectionControl?.required) {
    return true;
  }
  const dependencyId = reference.selectionControl?.dependencyId;
  return dependencyId &&
    dependencyId in draft.referenceSelectionDraftByDependencyId
    ? draft.referenceSelectionDraftByDependencyId[dependencyId]!
    : reference.selected;
}

export function generationPreviewDraftIsDirty(
  preview: StudioGenerationPreview,
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
  preview: StudioGenerationPreview,
  draft: GenerationPreviewDraft
): Pick<
  UpdateStudioGenerationPreviewSpecInput,
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
          dependencyId: control.dependencyId,
          selected: generationPreviewReferenceSelected(reference, draft),
        },
      ];
    }),
  };
}
