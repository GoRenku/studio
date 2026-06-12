import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ShotVideoTakeGenerationSpec,
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
  ValidateShotVideoTakeGenerationSpecInput,
  CreateShotVideoTakeGenerationSpecInput,
  UpdateShotVideoTakeGenerationSpecInput,
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
  modelChoices,
} from './model-list.js';
import {
  withShotProjectSession,
} from './project-session.js';
import {
  buildShotVideoTakeProviderPayload,
  toGenerationRequest,
} from './provider-payloads.js';
import {
  missingRequiredRouteInputLabelsForFinalSpec,
} from './route-settings.js';
import {
  sameShotIds,
} from './shot-group.js';
import {
  readShotSpec,
} from './spec-records.js';



export async function validateShotVideoTakeSpec(
  input: ValidateShotVideoTakeGenerationSpecInput
) {
  const normalized = normalizeFinalSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: normalized.target.sceneId,
    shotListId: normalized.target.shotListId,
    shotIds: normalized.target.shotIds,
    productionGroupId: normalized.target.productionGroupId,
  });
  validateFinalSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeProviderPayload(normalized, context);
  return { valid: true as const, spec: normalized, providerPayload: plan.payload };
}



export async function createShotVideoTakeSpec(
  input: CreateShotVideoTakeGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeFinalSpec(input.spec);
  await validateShotVideoTakeSpec({ ...input, spec: normalized });
  return withShotProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: normalized.title?.trim() || normalized.prompt.slice(0, 80) || 'Shot video take',
      now: new Date().toISOString(),
    });
  });
}



export async function updateShotVideoTakeSpec(
  input: UpdateShotVideoTakeGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeFinalSpec(input.spec);
  await validateShotVideoTakeSpec({ ...input, spec: normalized });
  return withShotProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: normalized.title?.trim() || normalized.prompt.slice(0, 80) || 'Shot video take',
      now: new Date().toISOString(),
    })
  );
}



export async function listShotVideoTakeSpecs(
  input: ShotVideoTakeContextInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildShotVideoTakeContext(input);
  return withShotProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      targetKind: 'sceneShotGroup',
      targetId: context.target.id,
    }),
  }));
}



export async function prepareShotVideoTakeSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readShotSpec(input);
  assertShotVideoTakeSpec(specRecord.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: specRecord.spec.target.sceneId,
    shotListId: specRecord.spec.target.shotListId,
    shotIds: specRecord.spec.target.shotIds,
    productionGroupId: specRecord.spec.target.productionGroupId,
  });
  validateFinalSpecAgainstContext(specRecord.spec, context);
  const plan = buildShotVideoTakeProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}



export async function prepareShotVideoTakeDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ShotVideoTakeGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = normalizeFinalSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: normalized.target.sceneId,
    shotListId: normalized.target.shotListId,
    shotIds: normalized.target.shotIds,
    productionGroupId: normalized.target.productionGroupId,
  });
  validateFinalSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}



export async function estimateShotVideoTakeSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareShotVideoTakeSpec(input);
  const { estimateGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  return { ...prepared, estimate };
}



export function normalizeFinalSpec(spec: ShotVideoTakeGenerationSpec): ShotVideoTakeGenerationSpec {
  if (spec.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA367',
      `Unsupported shot video take final purpose: ${spec.purpose}.`
    );
  }
  return { ...spec, parameterValues: spec.parameterValues ?? {}, inputs: spec.inputs ?? [] };
}



export function validateFinalSpecAgainstContext(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext
): void {
  validateFinalPricingSpecAgainstContext(spec, context);
  const missingInputs = missingRequiredRouteInputLabelsForFinalSpec({
    context,
    spec,
  });
  if (missingInputs.length > 0) {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      `Shot video take spec is missing required input${
        missingInputs.length === 1 ? '' : 's'
      }: ${missingInputs.join(', ')}.`
    );
  }
}



export function validateFinalPricingSpecAgainstContext(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext
): void {
  if (!sameShotIds(spec.target.shotIds, context.target.shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA370',
      'Shot video take spec targets a stale shot group.'
    );
  }
  const report = modelChoices(context, spec.inputModeId).find((model) => model.modelChoice === spec.modelChoice);
  if (!report || !report.available || !report.supportedInputModes.includes(spec.inputModeId)) {
    throw new ProjectDataError(
      'PROJECT_DATA371',
      'Shot video take model does not support the selected input mode for this shot group.'
    );
  }
  for (const key of Object.keys(spec.parameterValues)) {
    if (!report.parameters.some((parameter) => parameter.name === key)) {
      throw new ProjectDataError(
        'PROJECT_DATA372',
        `Unsupported shot video take parameter for selected model: ${key}.`
      );
    }
  }
}



export function assertShotVideoTakeSpec(
  spec: unknown
): asserts spec is ShotVideoTakeGenerationSpec {
  if (!spec || typeof spec !== 'object' || (spec as { purpose?: string }).purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError('PROJECT_DATA367', 'Media generation spec is not a shot video take spec.');
  }
}
