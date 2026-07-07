import type {
  GenerationPreviewRequest,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import {
  requireMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import type {
  BuildDraftMediaGenerationPreviewInput,
  BuildMediaGenerationPreviewInput,
  ReadMediaGenerationSpecInput,
  UpdateCastCharacterSheetReferenceInclusionInput,
} from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  type CreateMediaGenerationSpecInput,
  type ListMediaGenerationSpecsInput,
  type PrepareDraftMediaGenerationSpecInput,
  type UpdateMediaGenerationSpecInput,
  type ValidateMediaGenerationSpecInput,
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';
import { assertRootDependenciesResolved } from './dependency-service.js';
import { withMediaGenerationProjectSession } from './project-session.js';
import { updateCastCharacterSheetReferenceInclusion as updateCastCharacterSheetReferenceInclusionForSpec } from '../purposes/cast-character-sheet.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';

export async function validateMediaGenerationSpec(
  input: ValidateMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(input.spec.purpose).validateSpec(
    input
  );
}

export async function createMediaGenerationSpec(
  input: CreateMediaGenerationSpecInput
) {
  const definition = requireMediaGenerationPurposeDefinition(input.spec.purpose);
  if (definition.declareDependencies) {
    await assertRootDependenciesResolved(input);
  }
  return definition.createSpec(input);
}

export async function updateMediaGenerationSpec(
  input: UpdateMediaGenerationSpecInput
) {
  const definition = requireMediaGenerationPurposeDefinition(input.spec.purpose);
  if (definition.declareDependencies) {
    await assertRootDependenciesResolved(input);
  }
  return definition.updateSpec(input);
}

export async function readMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listMediaGenerationSpecs(
  input: ListMediaGenerationSpecsInput
) {
  return requireMediaGenerationPurposeDefinition(input.purpose).listSpecs(input);
}

export async function prepareMediaGenerationSpec(
  input: ReadMediaGenerationSpecInput
) {
  const specRecord = await readMediaGenerationSpec(input);
  return requireMediaGenerationPurposeDefinition(specRecord.purpose).prepareSpec(
    input
  );
}

export async function prepareDraftMediaGenerationSpec(
  input: PrepareDraftMediaGenerationSpecInput
) {
  return requireMediaGenerationPurposeDefinition(
    input.spec.purpose
  ).prepareDraftSpec(input);
}

export async function buildMediaGenerationPreview(
  input: BuildMediaGenerationPreviewInput
): Promise<GenerationPreviewRequest> {
  const specRecord = await readMediaGenerationSpec(input);
  return buildGenerationPreviewFromSpecRecord({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord,
  });
}

export async function buildDraftMediaGenerationPreview(
  input: BuildDraftMediaGenerationPreviewInput
): Promise<GenerationPreviewRequest> {
  const validated = await validateMediaGenerationSpec(input);
  return buildGenerationPreviewFromSpecRecord({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord: draftMediaGenerationSpecRecord(validated.spec),
  });
}

async function buildGenerationPreviewFromSpecRecord(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<GenerationPreviewRequest> {
  const { specRecord } = input;
  const definition = requireMediaGenerationPurposeDefinition(specRecord.purpose);
  if (definition.buildPreview) {
    return definition.buildPreview(input);
  }
  throw new ProjectDataError(
    'CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
    `Generation preview is not supported for purpose: ${specRecord.purpose}.`,
    {
      suggestion:
        'Use a previewable media generation purpose or add a Core preview builder before showing this spec in Studio.',
    }
  );
}

export async function updateCastCharacterSheetReferenceInclusion(
  input: UpdateCastCharacterSheetReferenceInclusionInput
): Promise<GenerationPreviewRequest> {
  return updateCastCharacterSheetReferenceInclusionForSpec(input);
}
