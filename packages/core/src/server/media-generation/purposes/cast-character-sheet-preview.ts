import type {
  CastCharacterSheetGenerationSpec,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import type { ApplyMediaGenerationPreviewUpdateInput } from '../lifecycle/purpose-definition.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  applyCastCharacterSheetPreviewReferenceSelections,
  applyCastCharacterSheetReferenceSelectionUpdates,
  buildCastCharacterSheetContext,
  resolveCastCharacterSheetReferenceOptions,
  updateCastCharacterSheetSpec,
} from './cast-character-sheet.js';
import type { MediaGenerationPurposeImageRegeneration } from '../lifecycle/purpose-definition.js';
import { applyAuthoredPromptImageRegeneration } from '../../image-revision/authored-prompt-regeneration.js';

export async function updateCastCharacterSheetGenerationPreview(
  input: ApplyMediaGenerationPreviewUpdateInput,
): Promise<MediaGenerationSpecRecord> {
  if (input.prompt.negativeText !== undefined) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_NEGATIVE_PROMPT_UPDATE_UNSUPPORTED',
      'Cast Character Sheet generation does not support a negative prompt.',
    );
  }
  let spec = {
    ...input.specRecord.spec,
    prompt: input.prompt.authoredText,
  } as CastCharacterSheetGenerationSpec;
  if (input.referenceSelections.length > 0) {
    spec = await applyCastCharacterSheetPreviewReferenceSelections({
      projectName: input.projectName,
      homeDir: input.homeDir,
      specRecord: { ...input.specRecord, spec },
      referenceSelections: input.referenceSelections,
    });
  }
  return updateCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specRecord.id,
    spec,
  });
}

export const castCharacterSheetImageRegeneration = {
  async applyEditor(input) {
    const spec = applyAuthoredPromptImageRegeneration(
      input.spec,
      { ...input.draft, referenceSelections: [] },
    ) as CastCharacterSheetGenerationSpec;
    const context = await buildCastCharacterSheetContext({
      projectName: input.projectName,
      homeDir: input.homeDir,
      castMemberId: spec.target.id,
    });
    return applyCastCharacterSheetReferenceSelectionUpdates({
      spec,
      referenceOptions: resolveCastCharacterSheetReferenceOptions({
        context,
        referenceSelections: input.spec.purpose === 'cast.character-sheet'
          ? input.spec.referenceSelections
          : undefined,
      }),
      referenceSelections: input.draft.referenceSelections,
    });
  },
} satisfies MediaGenerationPurposeImageRegeneration;
