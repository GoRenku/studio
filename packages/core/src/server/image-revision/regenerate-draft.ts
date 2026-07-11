import type {
  GenerationPreviewRequest,
  ImageRevisionDraft,
  MediaGenerationSpec,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function createRegenerateDraft(
  spec: MediaGenerationSpec,
  preview: GenerationPreviewRequest,
): ImageRevisionDraft {
  requireRegeneratableSpec(spec);
  return {
    mode: 'regenerate',
    authoredText: spec.prompt,
    ...('negativePrompt' in spec && typeof spec.negativePrompt === 'string'
      ? { negativeText: spec.negativePrompt }
      : {}),
    referenceSelections: preview.references.flatMap((reference) =>
      reference.selectionControl
        ? [
            {
              dependencyId: reference.selectionControl.dependencyId,
              selected: reference.selected,
            },
          ]
        : [],
    ),
    generationControls: [],
  };
}

function requireRegeneratableSpec(
  spec: MediaGenerationSpec,
): asserts spec is MediaGenerationSpec & { prompt: string } {
  if (
    !('prompt' in spec) ||
    typeof spec.prompt !== 'string'
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_REGENERATE_PURPOSE_UNSUPPORTED',
      `Media generation purpose cannot be regenerated from Image Revision: ${spec.purpose}.`,
    );
  }
}
