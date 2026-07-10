import type {
  GenerationPreviewRequest,
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import { requireMediaGenerationSpec } from '../../database/access/media-generation.js';
import type { UpdateGenerationPreviewSpecInput } from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import { withMediaGenerationProjectSession } from './project-session.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';

export async function updateGenerationPreviewSpec(
  input: UpdateGenerationPreviewSpecInput
): Promise<GenerationPreviewRequest> {
  validatePromptUpdate(input.prompt);
  const specRecord = await withMediaGenerationProjectSession(
    input,
    ({ session }) => requireMediaGenerationSpec(session, input.specId)
  );
  const definition = requireMediaGenerationPurposeDefinition(
    specRecord.purpose
  );
  requirePreviewBuilder(definition.buildPreview, specRecord.purpose);

  const supportsNegativePrompt = input.prompt.negativeText === undefined
    ? false
    : await definition.supportsPreviewNegativePrompt?.({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specRecord,
      }) ?? false;
  let nextSpec = applyPromptUpdate(
    specRecord.spec,
    input.prompt,
    supportsNegativePrompt
  );
  if (input.referenceSelections.length > 0) {
    if (!definition.applyPreviewReferenceSelections) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PREVIEW_REFERENCE_UPDATE_UNSUPPORTED',
        `Generation preview references cannot be updated for purpose: ${specRecord.purpose}.`,
        {
          suggestion:
            'Update only the prompt, or add a purpose-owned preview reference update hook before exposing editable references.',
        }
      );
    }
    nextSpec = await definition.applyPreviewReferenceSelections({
      projectName: input.projectName,
      homeDir: input.homeDir,
      specRecord: { ...specRecord, spec: nextSpec },
      referenceSelections: input.referenceSelections,
    });
  }

  const updatedSpecRecord = await definition.updateSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: nextSpec,
  });
  return definition.buildPreview({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord: updatedSpecRecord,
  });
}

export async function buildGenerationPreviewFromSpecRecord(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<GenerationPreviewRequest> {
  const definition = requireMediaGenerationPurposeDefinition(
    input.specRecord.purpose
  );
  requirePreviewBuilder(definition.buildPreview, input.specRecord.purpose);
  return definition.buildPreview(input);
}

function validatePromptUpdate(
  prompt: UpdateGenerationPreviewSpecInput['prompt']
): void {
  if (!prompt || typeof prompt.authoredText !== 'string') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_PROMPT_INVALID',
      'Generation preview authored prompt text must be a string.'
    );
  }
  if (
    prompt.negativeText !== undefined &&
    prompt.negativeText !== null &&
    typeof prompt.negativeText !== 'string'
  ) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_NEGATIVE_PROMPT_INVALID',
      'Generation preview negative prompt text must be a string or null when provided.'
    );
  }
}

function applyPromptUpdate(
  spec: MediaGenerationSpec,
  prompt: UpdateGenerationPreviewSpecInput['prompt'],
  supportsNegativePrompt: boolean
): MediaGenerationSpec {
  if (!('prompt' in spec)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_PROMPT_UPDATE_UNSUPPORTED',
      `Generation preview prompt cannot be updated for purpose: ${spec.purpose}.`
    );
  }
  const nextSpec = {
    ...spec,
    prompt: prompt.authoredText,
  } as MediaGenerationSpec;
  if (prompt.negativeText === undefined) {
    return nextSpec;
  }
  if (!supportsNegativePrompt) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_NEGATIVE_PROMPT_UPDATE_UNSUPPORTED',
      `Generation preview negative prompt cannot be updated for purpose: ${spec.purpose}.`
    );
  }
  if (prompt.negativeText === null) {
    delete (nextSpec as { negativePrompt?: string }).negativePrompt;
  } else {
    (nextSpec as { negativePrompt?: string }).negativePrompt =
      prompt.negativeText;
  }
  return nextSpec;
}

function requirePreviewBuilder(
  buildPreview:
    | ((input: {
        projectName?: string;
        homeDir?: string;
        specRecord: MediaGenerationSpecRecord;
      }) => Promise<GenerationPreviewRequest>)
    | undefined,
  purpose: string
): asserts buildPreview is NonNullable<typeof buildPreview> {
  if (!buildPreview) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
      `Generation preview is not supported for purpose: ${purpose}.`,
      {
        suggestion:
          'Use a previewable media generation purpose or add a Core preview builder before showing this spec in Studio.',
      }
    );
  }
}
