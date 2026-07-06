import {
  createDiagnosticError,
} from '@gorenku/studio-diagnostics';
import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  MediaGenerationSpecRecord,
  ShotVideoTakeInputGenerationPurpose,
  PreparedMediaGeneration,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeProductionContext,
  ShotVideoInputReferenceMode,
  GenerationPreviewRequestReference,
} from '../../../../../client/index.js';
import {
  insertMediaGenerationSpec,
  updateMediaGenerationSpec,
  listMediaGenerationSpecs,
} from '../../../../database/access/media-generation.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../../../entity-ids.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import type {
  ValidateShotVideoTakeInputGenerationSpecInput,
  CreateShotVideoTakeInputGenerationSpecInput,
  UpdateShotVideoTakeInputGenerationSpecInput,
  ShotVideoTakeContextInput,
  ReadMediaGenerationSpecInput,
} from '../../../../project-data-service-contracts.js';
import {
  draftMediaGenerationSpecRecord,
} from '../../../cost/draft-generation.js';
import {
  buildShotVideoTakeContext,
} from '../authoring/context.js';
import {
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  buildShotVideoTakeInputProviderPayload,
  toGenerationRequest,
} from '../provider/provider-payloads.js';
import { buildSavedImageGenerationPreview } from '../../../../generation-preview/saved-image-preview.js';
import { providerPreviewPromptText } from '../../../../generation-preview/provider-preview-prompt.js';
import {
  INPUT_MODEL_CHOICES,
  PURPOSE_CONFIG,
  isShotInputPurpose,
  titleForInputSpec,
} from '../shared/purpose-config.js';
import { shotInputModelChoices } from './model-list.js';
import {
  validatePromptSheetMetadataAbsent,
  validateVideoPromptSheetMetadata,
} from './prompt-sheet-metadata.js';
import {
  assertEditableSceneShotVideoTake,
  sameShotIds,
} from '../authoring/take-context.js';
import {
  readShotSpec,
} from './spec-records.js';
import {
  type ShotVideoInputReferenceBundle,
  resolveShotVideoInputReferenceBundle,
} from '../planning/shot-input-references.js';



export async function validateShotInputSpec(input: ValidateShotVideoTakeInputGenerationSpecInput) {
  const normalized = normalizeInputSpec(input.spec);
  const { context, plan } = await prepareShotInputProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return {
    valid: true as const,
    spec: normalized,
    providerPayload: plan.payload,
    context,
  };
}



export const validateShotFirstFrameSpec = validateShotInputSpec;


export const validateShotLastFrameSpec = validateShotInputSpec;


export const validateShotReferenceImageSpec = validateShotInputSpec;


export const validateShotVideoPromptSheetSpec = validateShotInputSpec;



export async function createShotInputSpec(
  input: CreateShotVideoTakeInputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeInputSpec(input.spec);
  const validation = await validateShotInputSpec({ ...input, spec: normalized });
  assertEditableSceneShotVideoTake(validation.context.take);
  return withShotProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForInputSpec(normalized),
      now: new Date().toISOString(),
    });
  });
}



export const createShotFirstFrameSpec = createShotInputSpec;


export const createShotLastFrameSpec = createShotInputSpec;


export const createShotReferenceImageSpec = createShotInputSpec;


export const createShotVideoPromptSheetSpec = createShotInputSpec;



export async function updateShotInputSpec(
  input: UpdateShotVideoTakeInputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeInputSpec(input.spec);
  const validation = await validateShotInputSpec({ ...input, spec: normalized });
  assertEditableSceneShotVideoTake(validation.context.take);
  return withShotProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForInputSpec(normalized),
      now: new Date().toISOString(),
    })
  );
}



export const updateShotFirstFrameSpec = updateShotInputSpec;


export const updateShotLastFrameSpec = updateShotInputSpec;


export const updateShotReferenceImageSpec = updateShotInputSpec;


export const updateShotVideoPromptSheetSpec = updateShotInputSpec;



export async function listShotInputSpecs(
  input: ShotVideoTakeContextInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildShotVideoTakeContext(input);
  return withShotProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose,
      targetKind: 'sceneShotVideoTake',
      targetId: context.target.id,
    }),
  }));
}



export const listShotFirstFrameSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_FIRST_FRAME_GENERATION_PURPOSE);


export const listShotLastFrameSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_LAST_FRAME_GENERATION_PURPOSE);


export const listShotReferenceImageSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE);


export const listShotVideoPromptSheetSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE);



export async function prepareShotInputSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readShotSpec(input);
  assertShotInputSpec(specRecord.spec);
  const { plan } = await prepareShotInputProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: specRecord.spec,
  });
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function buildShotInputGenerationPreview(
  input: ReadMediaGenerationSpecInput
) {
  const specRecord = await readShotSpec(input);
  assertShotInputSpec(specRecord.spec);
  const { context, plan, references } = await prepareShotInputProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: specRecord.spec,
  });
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: specRecord.spec.purpose,
    project: context.project,
    target: specRecord.target,
    title: specRecord.title,
    modelChoice: specRecord.spec.modelChoice,
    modelLabel:
      shotInputModelChoices().find(
        (model) => model.modelChoice === specRecord.spec.modelChoice
      )?.label ?? specRecord.spec.modelChoice,
    provider: plan.provider,
    providerModel: plan.model,
    mode: plan.mode === 'reference-to-image' ? 'reference-to-image' : 'text-to-image',
    prompt: providerPreviewPromptText(plan.payload, specRecord.spec.prompt),
    references: shotInputPreviewReferences(references),
    providerTokenOrder: shotInputProviderTokenOrder(references),
    payload: plan.payload,
    ...(specRecord.spec.purpose === SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE
      ? {
          promptSheetVisualStyleId: specRecord.spec.promptSheetVisualStyleId,
          promptSheetNotationModeId: specRecord.spec.promptSheetNotationModeId,
        }
      : {}),
  });
}



export async function prepareShotInputDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ShotVideoTakeInputGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = normalizeInputSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeId: normalized.target.takeId,
  });
  const { plan } = await prepareShotInputProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
    context,
  });
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}



export const prepareShotFirstFrameSpec = prepareShotInputSpec;


export const prepareShotLastFrameSpec = prepareShotInputSpec;


export const prepareShotReferenceImageSpec = prepareShotInputSpec;


export const prepareShotVideoPromptSheetSpec = prepareShotInputSpec;



export function normalizeInputSpec(
  spec: ShotVideoTakeInputGenerationSpec
): ShotVideoTakeInputGenerationSpec {
  if (!isShotInputPurpose(spec.purpose)) {
    throw new ProjectDataError(
      'PROJECT_DATA364',
      `Unsupported shot video take input purpose: ${spec.purpose}.`
    );
  }
  if (!INPUT_MODEL_CHOICES.has(spec.modelChoice)) {
    throw new ProjectDataError(
      'PROJECT_DATA365',
      `Unsupported shot video take input model: ${spec.modelChoice}.`
    );
  }
  const referenceMode = (spec as Partial<ShotVideoTakeInputGenerationSpec>)
    .referenceMode;
  if (referenceMode === undefined) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_REQUIRED',
      'Shot video take input spec requires referenceMode.',
      {
        issues: [
          createDiagnosticError(
            'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_REQUIRED',
            'Shot video take input spec requires referenceMode.',
            { path: ['referenceMode'], context: 'Shot video take input spec' },
            'Use referenceMode "movie-lookbook" unless the user explicitly requested Storyboard Lookbook, hand-drawn, sketch, or animatic aesthetics.'
          ),
        ],
        suggestion:
          'Use referenceMode "movie-lookbook" for ordinary shot input images.',
      }
    );
  }
  if (!isShotVideoInputReferenceMode(referenceMode)) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_UNSUPPORTED',
      `Unsupported shot video take input referenceMode: ${String(referenceMode)}.`,
      {
        issues: [
          createDiagnosticError(
            'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_UNSUPPORTED',
            `Unsupported shot video take input referenceMode: ${String(referenceMode)}.`,
            { path: ['referenceMode'], context: 'Shot video take input spec' },
            'Use "movie-lookbook" or "storyboard-lookbook".'
          ),
        ],
        suggestion:
          'Use referenceMode "movie-lookbook" unless explicit storyboard aesthetics are required.',
      }
    );
  }
  const config = PURPOSE_CONFIG[spec.purpose];
  if (
    spec.dependencyKind !== config.dependencyKind ||
    spec.outputInputKind !== config.outputInputKind
  ) {
    const subject = expectedSubjectForInputSpec(spec);
    throw new ProjectDataError(
      'PROJECT_DATA366',
      'Shot video take input spec purpose, dependencyKind, and outputInputKind do not match.',
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA366',
            `For purpose ${spec.purpose}, dependencyKind must be "${config.dependencyKind}" and outputInputKind must be "${config.outputInputKind}".`,
            { path: ['dependencyKind'], context: 'Shot video take input spec' },
            `Use dependencyKind "${config.dependencyKind}", outputInputKind "${config.outputInputKind}", subjectKind "${subject.subjectKind}", and subjectId "${subject.subjectId}".`
          ),
        ],
        suggestion:
          `For purpose ${spec.purpose}, use dependencyKind "${config.dependencyKind}" and outputInputKind "${config.outputInputKind}". Use subjectKind "${subject.subjectKind}" and subjectId "${subject.subjectId}" when authoring dependency drafts or inspecting preflight output.`,
      }
    );
  }
  return { ...spec, parameterValues: spec.parameterValues ?? {} };
}

async function prepareShotInputProviderPlan(input: {
  projectName?: string;
  homeDir?: string;
  spec: ShotVideoTakeInputGenerationSpec;
  context?: ShotVideoTakeProductionContext;
}): Promise<{
  context: ShotVideoTakeProductionContext;
  plan: ReturnType<typeof buildShotVideoTakeInputProviderPayload>;
  references: ShotVideoInputReferenceBundle;
}> {
  const context =
    input.context ??
    await buildShotVideoTakeContext({
      projectName: input.projectName,
      homeDir: input.homeDir,
      takeId: input.spec.target.takeId,
    });
  validateInputSpecAgainstContext(input.spec, context);
  return withShotProjectSession(input, ({ session }) => {
    const references = resolveShotVideoInputReferenceBundle({
      session,
      context,
      purpose: input.spec.purpose,
      referenceMode: input.spec.referenceMode,
    });
    const plan = buildShotVideoTakeInputProviderPayload({
      spec: input.spec,
      context,
      references,
    });
    return { context, plan, references };
  });
}

function shotInputPreviewReferences(
  bundle: ShotVideoInputReferenceBundle
): GenerationPreviewRequestReference[] {
  return [
    ...(bundle.styleReference ? [bundle.styleReference] : []),
    ...bundle.continuityReferences,
  ].map((reference) => ({
    kind: 'image' as const,
    role: reference.role,
    label: reference.label,
    providerToken: 'image_urls',
    assetId: reference.assetId,
    assetFileId: reference.assetFileId,
    selected: true,
  }));
}

function shotInputProviderTokenOrder(
  bundle: ShotVideoInputReferenceBundle
): string[] {
  return [
    ...(bundle.styleReference ? [bundle.styleReference.dependencyId] : []),
    ...bundle.continuityReferences.map((reference) => reference.dependencyId),
  ];
}

function isShotVideoInputReferenceMode(
  value: unknown
): value is ShotVideoInputReferenceMode {
  return value === 'movie-lookbook' || value === 'storyboard-lookbook';
}

function expectedSubjectForInputSpec(spec: ShotVideoTakeInputGenerationSpec): {
  subjectKind: 'shot' | 'take';
  subjectId: string;
} {
  if (spec.outputInputKind === 'video-prompt-sheet') {
    return {
      subjectKind: 'take',
      subjectId: spec.target.takeId,
    };
  }
  return {
    subjectKind: 'shot',
    subjectId: spec.target.shotIds[0] ?? '<shot-id>',
  };
}



export function validateInputSpecAgainstContext(
  spec: ShotVideoTakeInputGenerationSpec,
  context: ShotVideoTakeProductionContext
): void {
  if (!spec.prompt.trim()) {
    throw new ProjectDataError(
      'PROJECT_DATA416',
      'Shot video take input spec requires an authored prompt.'
    );
  }
  if (
    spec.purpose === SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE &&
    !spec.title?.trim()
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA417',
      'shot.reference-image requires a title that names the reference intent.'
    );
  }
  if (!sameShotIds(spec.target.shotIds, context.target.shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA368',
      'Shot video take input spec targets stale take shot ids.'
    );
  }
  if (
    spec.purpose === SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE
  ) {
    validateVideoPromptSheetMetadata(spec);
    return;
  }
  validatePromptSheetMetadataAbsent(spec);
}

export function assertShotInputSpec(
  spec: unknown
): asserts spec is ShotVideoTakeInputGenerationSpec {
  if (!spec || typeof spec !== 'object' || !isShotInputPurpose((spec as { purpose?: string }).purpose)) {
    throw new ProjectDataError('PROJECT_DATA364', 'Media generation spec is not a shot video take input spec.');
  }
}
