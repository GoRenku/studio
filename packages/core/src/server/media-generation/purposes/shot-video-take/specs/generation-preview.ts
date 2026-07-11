import type {
  MediaGenerationSpecRecord,
  ShotVideoTakeOutputGenerationSpec,
} from '../../../../../client/index.js';
import type { ApplyMediaGenerationPreviewUpdateInput } from '../../../lifecycle/purpose-definition.js';
import { ProjectDataError } from '../../../../project-data-error.js';
import {
  shotVideoTakeSpecSupportsNegativePrompt,
  updateShotVideoTakeSpec,
} from './final-specs.js';

export async function updateShotVideoTakeGenerationPreview(
  input: ApplyMediaGenerationPreviewUpdateInput,
): Promise<MediaGenerationSpecRecord> {
  if (input.referenceSelections.length > 0) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_REFERENCE_UPDATE_UNSUPPORTED',
      'Shot Video Take generation preview references are read-only.',
    );
  }
  const supportsNegativePrompt = await shotVideoTakeSpecSupportsNegativePrompt({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord: input.specRecord,
  });
  const spec = {
    ...input.specRecord.spec,
    prompt: input.prompt.authoredText,
  } as ShotVideoTakeOutputGenerationSpec;
  if (input.prompt.negativeText !== undefined) {
    if (!supportsNegativePrompt) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PREVIEW_NEGATIVE_PROMPT_UPDATE_UNSUPPORTED',
        'The selected Shot Video Take model does not support a negative prompt.',
      );
    }
    if (input.prompt.negativeText === null) {
      delete spec.negativePrompt;
    } else {
      spec.negativePrompt = input.prompt.negativeText;
    }
  }
  return updateShotVideoTakeSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specRecord.id,
    spec,
  });
}
