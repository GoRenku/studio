import type {
  ImageRevisionDraft,
  MediaGenerationSpec,
} from '../../client/index.js';
import type { MediaGenerationPurposeImageRegeneration } from '../media-generation/lifecycle/purpose-definition.js';
import { ProjectDataError } from '../project-data-error.js';

export function createAuthoredPromptImageRegeneration(): MediaGenerationPurposeImageRegeneration {
  return {
    async applyEditor(input) {
      return applyAuthoredPromptImageRegeneration(input.spec, input.draft);
    },
  };
}

export function applyAuthoredPromptImageRegeneration(
  spec: MediaGenerationSpec,
  draft: ImageRevisionDraft,
): MediaGenerationSpec {
  if (
    draft.mode !== 'regenerate' ||
    !('prompt' in spec) ||
    typeof spec.prompt !== 'string'
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_DRAFT_INVALID',
      `Media generation purpose cannot apply a Regenerate draft: ${spec.purpose}.`,
    );
  }
  if (draft.referenceSelections.length > 0) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_CONTROL_UNSUPPORTED',
      `Media generation purpose does not expose editable Regenerate references: ${spec.purpose}.`,
    );
  }
  const nextSpec = {
    ...spec,
    prompt: draft.authoredText,
  } as MediaGenerationSpec;
  if ('takeCount' in nextSpec) {
    (nextSpec as MediaGenerationSpec & { takeCount: number }).takeCount = 1;
  }
  if ('parameterValues' in nextSpec) {
    const parameterValues =
      (nextSpec as MediaGenerationSpec & {
        parameterValues: Record<string, unknown>;
      }).parameterValues ?? {};
    (nextSpec as MediaGenerationSpec & {
      parameterValues: Record<string, unknown>;
    }).parameterValues = { ...parameterValues, num_images: 1 };
  }
  return nextSpec;
}
