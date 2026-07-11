import type { GenerationPreviewRequest } from '../../client/index.js';
import type { MediaGenerationSpecRecord } from '../../client/index.js';
import { requireMediaGenerationSpec } from '../database/access/media-generation.js';
import { draftMediaGenerationSpecRecord } from '../media-generation/cost/draft-generation.js';
import {
  readMediaGenerationSpec,
  validateMediaGenerationSpec,
} from '../media-generation/lifecycle/spec-service.js';
import { withMediaGenerationProjectSession } from '../media-generation/lifecycle/project-session.js';
import { requireMediaGenerationPurposeDefinition } from '../media-generation/lifecycle/purpose-lifecycle-registry.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  BuildDraftMediaGenerationPreviewInput,
  BuildMediaGenerationPreviewInput,
  UpdateGenerationPreviewSpecInput,
} from './contracts.js';

export async function buildMediaGenerationPreview(
  input: BuildMediaGenerationPreviewInput,
): Promise<GenerationPreviewRequest> {
  const specRecord = await readMediaGenerationSpec(input);
  return buildGenerationPreviewFromSpecRecord({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord,
  });
}

export async function buildDraftMediaGenerationPreview(
  input: BuildDraftMediaGenerationPreviewInput,
): Promise<GenerationPreviewRequest> {
  const validated = await validateMediaGenerationSpec(input);
  return buildGenerationPreviewFromSpecRecord({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord: draftMediaGenerationSpecRecord(validated.spec),
  });
}

export async function updateGenerationPreviewSpec(
  input: UpdateGenerationPreviewSpecInput,
): Promise<GenerationPreviewRequest> {
  validatePromptUpdate(input.prompt);
  const specRecord = await withMediaGenerationProjectSession(
    input,
    ({ session }) => requireMediaGenerationSpec(session, input.specId),
  );
  const preview = requirePurposePreview(specRecord);
  if (!preview.update) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_UPDATE_UNSUPPORTED',
      `Generation preview cannot be updated for purpose: ${specRecord.purpose}.`,
    );
  }
  const updatedSpecRecord = await preview.update({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord,
    prompt: input.prompt,
    referenceSelections: input.referenceSelections,
  });
  return preview.build({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord: updatedSpecRecord,
  });
}

async function buildGenerationPreviewFromSpecRecord(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<GenerationPreviewRequest> {
  return requirePurposePreview(input.specRecord).build(input);
}

function requirePurposePreview(specRecord: MediaGenerationSpecRecord) {
  const preview = requireMediaGenerationPurposeDefinition(
    specRecord.purpose,
  ).preview;
  if (!preview) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
      `Generation preview is not supported for purpose: ${specRecord.purpose}.`,
      {
        suggestion:
          'Use a previewable media generation purpose or add a Core preview capability before showing this spec in Studio.',
      },
    );
  }
  return preview;
}

function validatePromptUpdate(
  prompt: UpdateGenerationPreviewSpecInput['prompt'],
): void {
  if (!prompt || typeof prompt.authoredText !== 'string') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_PROMPT_INVALID',
      'Generation preview authored prompt text must be a string.',
    );
  }
  if (
    prompt.negativeText !== undefined &&
    prompt.negativeText !== null &&
    typeof prompt.negativeText !== 'string'
  ) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_NEGATIVE_PROMPT_INVALID',
      'Generation preview negative prompt text must be a string or null when provided.',
    );
  }
}
