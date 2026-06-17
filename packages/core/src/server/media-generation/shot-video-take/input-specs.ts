import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  MediaGenerationSpecRecord,
  ShotVideoTakeInputGenerationPurpose,
  PreparedMediaGeneration,
  ShotVideoTakeInputGenerationSpec,
  MediaGenerationEstimateReport,
  ShotVideoTakeGenerationContext,
} from '../../../client/index.js';
import {
  insertMediaGenerationSpec,
  updateMediaGenerationSpec,
  listMediaGenerationSpecs,
} from '../../database/access/media-generation.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../entity-ids.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ValidateShotVideoTakeInputGenerationSpecInput,
  CreateShotVideoTakeInputGenerationSpecInput,
  UpdateShotVideoTakeInputGenerationSpecInput,
  ShotVideoTakeContextInput,
  ReadMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import {
  draftMediaGenerationSpecRecord,
} from '../draft-generation.js';
import {
  buildShotVideoTakeContext,
} from './context.js';
import {
  withShotProjectSession,
} from './project-session.js';
import {
  buildShotVideoTakeInputProviderPayload,
  toGenerationRequest,
} from './provider-payloads.js';
import {
  INPUT_MODEL_CHOICES,
  PURPOSE_CONFIG,
  isShotInputPurpose,
  titleForInputSpec,
} from './purpose-config.js';
import {
  sameShotIds,
} from './take-generation-context.js';
import {
  readShotSpec,
} from './spec-records.js';



export async function validateShotInputSpec(input: ValidateShotVideoTakeInputGenerationSpecInput) {
  const normalized = normalizeInputSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    takeGenerationId: normalized.target.takeGenerationId,
  });
  validateInputSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeInputProviderPayload(normalized);
  return { valid: true as const, spec: normalized, providerPayload: plan.payload };
}



export const validateShotFirstFrameSpec = validateShotInputSpec;


export const validateShotLastFrameSpec = validateShotInputSpec;


export const validateShotReferenceImageSpec = validateShotInputSpec;


export const validateShotMultiShotStoryboardSheetSpec = validateShotInputSpec;



export async function createShotInputSpec(
  input: CreateShotVideoTakeInputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeInputSpec(input.spec);
  await validateShotInputSpec({ ...input, spec: normalized });
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


export const createShotMultiShotStoryboardSheetSpec = createShotInputSpec;



export async function updateShotInputSpec(
  input: UpdateShotVideoTakeInputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeInputSpec(input.spec);
  await validateShotInputSpec({ ...input, spec: normalized });
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


export const updateShotMultiShotStoryboardSheetSpec = updateShotInputSpec;



export async function listShotInputSpecs(
  input: ShotVideoTakeContextInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildShotVideoTakeContext(input);
  return withShotProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose,
      targetKind: 'sceneShotVideoTakeGeneration',
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


export const listShotMultiShotStoryboardSheetSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE);



export async function prepareShotInputSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readShotSpec(input);
  assertShotInputSpec(specRecord.spec);
  const plan = buildShotVideoTakeInputProviderPayload(specRecord.spec);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
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
    takeGenerationId: normalized.target.takeGenerationId,
  });
  validateInputSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeInputProviderPayload(normalized);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}



export const prepareShotFirstFrameSpec = prepareShotInputSpec;


export const prepareShotLastFrameSpec = prepareShotInputSpec;


export const prepareShotReferenceImageSpec = prepareShotInputSpec;


export const prepareShotMultiShotStoryboardSheetSpec = prepareShotInputSpec;



export async function estimateShotInputSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareShotInputSpec(input);
  const { estimateGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  return { ...prepared, estimate };
}



export const estimateShotFirstFrameSpec = estimateShotInputSpec;


export const estimateShotLastFrameSpec = estimateShotInputSpec;


export const estimateShotReferenceImageSpec = estimateShotInputSpec;


export const estimateShotMultiShotStoryboardSheetSpec = estimateShotInputSpec;



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
  const config = PURPOSE_CONFIG[spec.purpose];
  if (
    spec.dependencyKind !== config.dependencyKind ||
    spec.outputInputKind !== config.outputInputKind
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA366',
      'Shot video take input spec purpose, dependencyKind, and outputInputKind do not match.'
    );
  }
  return { ...spec, parameterValues: spec.parameterValues ?? {} };
}



export function validateInputSpecAgainstContext(
  spec: ShotVideoTakeInputGenerationSpec,
  context: ShotVideoTakeGenerationContext
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
      'Shot video take input spec targets stale take-generation shot ids.'
    );
  }
  if (
    spec.purpose === SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE &&
    context.target.shotIds.length < 2
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA369',
      'shot.multi-shot-storyboard-sheet requires a multi-shot take generation.'
    );
  }
}



export function assertShotInputSpec(
  spec: unknown
): asserts spec is ShotVideoTakeInputGenerationSpec {
  if (!spec || typeof spec !== 'object' || !isShotInputPurpose((spec as { purpose?: string }).purpose)) {
    throw new ProjectDataError('PROJECT_DATA364', 'Media generation spec is not a shot video take input spec.');
  }
}
