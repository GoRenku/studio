import type {
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
} from '../../client/index.js';
import type { ApplyMediaGenerationPreviewUpdateInput } from '../media-generation/lifecycle/purpose-definition.js';
import { ProjectDataError } from '../project-data-error.js';

export function createAuthoredPromptPreviewUpdate<
  Spec extends MediaGenerationSpec & { prompt: string },
>(updateSpec: (input: {
  projectName?: string;
  homeDir?: string;
  specId: string;
  spec: Spec;
}) => Promise<MediaGenerationSpecRecord>) {
  return async (
    input: ApplyMediaGenerationPreviewUpdateInput,
  ): Promise<MediaGenerationSpecRecord> => {
    if (input.prompt.negativeText !== undefined) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PREVIEW_NEGATIVE_PROMPT_UPDATE_UNSUPPORTED',
        `Generation preview negative prompt cannot be updated for purpose: ${input.specRecord.purpose}.`,
      );
    }
    if (input.referenceSelections.length > 0) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PREVIEW_REFERENCE_UPDATE_UNSUPPORTED',
        `Generation preview references cannot be updated for purpose: ${input.specRecord.purpose}.`,
      );
    }
    if (!('prompt' in input.specRecord.spec)) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PREVIEW_PROMPT_UPDATE_UNSUPPORTED',
        `Generation preview prompt cannot be updated for purpose: ${input.specRecord.purpose}.`,
      );
    }
    return updateSpec({
      projectName: input.projectName,
      homeDir: input.homeDir,
      specId: input.specRecord.id,
      spec: {
        ...input.specRecord.spec,
        prompt: input.prompt.authoredText,
      } as Spec,
    });
  };
}
