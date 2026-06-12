import type {
  CastCharacterSheetGenerationContext,
  CastCharacterSheetGenerationSpec,
  CastCharacterSheetModelChoice,
  CastCharacterSheetModelListReport,
  CastImageModelChoiceReport,
  CastMediaImportReport,
  MediaGenerationEstimateReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
} from '../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
} from '../../client/index.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../database/access/media-generation.js';
import {
  readActiveCastDesignDocument,
  toCastDesignSummary,
} from '../database/access/department-design.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { studioResourceKeysForAssetTarget } from '../studio-coordination/resource-keys.js';
import { draftMediaGenerationSpecRecord } from './draft-generation.js';
import type {
  MediaGenerationDependencyDraftSpec,
  MediaGenerationDependencyDraftSpecInput,
} from './dependency-draft-specs.js';
import {
  buildScreenplayContext,
  buildTimePeriodContext,
  imageFileReferences,
  importCastImageMedia,
  mapGptQuality,
  mapNanoBananaResolution,
  mapPresetFrame,
  normalizeCastImageSpecControls,
  readCastAssetsByRole,
  readCastProjectContext,
  requireActiveLookbookContext,
  requireCastMemberForContext,
  requireTakeCount,
  resolveCastGenerationOutputPaths,
  resolveCastImageFrame,
  titleForSpec,
  toGenerationRequest,
  validateCastTarget,
  withCastProjectSession,
  type CastProviderPlan,
} from './cast-image-common.js';

const CHARACTER_SHEET_MODELS = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

export interface CastCharacterSheetProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface CastCharacterSheetTargetInput extends CastCharacterSheetProjectInput {
  castMemberId: string;
}

export interface CastCharacterSheetSpecFileInput extends CastCharacterSheetProjectInput {
  spec: CastCharacterSheetGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface CastCharacterSheetSpecIdInput extends CastCharacterSheetProjectInput {
  specId: string;
}

export interface UpdateCastCharacterSheetSpecInput extends CastCharacterSheetSpecIdInput {
  spec: CastCharacterSheetGenerationSpec;
}

export interface RunCastCharacterSheetSpecInput extends CastCharacterSheetSpecIdInput {
  approvalToken?: string;
  simulate?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface RecordCastCharacterSheetRunInput extends CastCharacterSheetSpecIdInput {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  providerPayload: Record<string, unknown>;
  estimate: unknown;
  approvalToken?: string;
  simulated: boolean;
  status: 'simulated' | 'completed' | 'failed';
  outputs: unknown;
  diagnostics: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface ImportCastCharacterSheetMediaInput extends CastCharacterSheetTargetInput {
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export async function buildCastCharacterSheetContext(
  input: CastCharacterSheetTargetInput
): Promise<CastCharacterSheetGenerationContext> {
  const projectContext = await readCastProjectContext(input);
  return withCastProjectSession(input, ({ session, projectFolder }) => {
    const castMember = requireCastMemberForContext(session, input.castMemberId);
    const activeLookbook = requireActiveLookbookContext(session);
    const activeCastDesign = readActiveCastDesignDocument(session, input.castMemberId);
    const assets = readCastAssetsByRole(session, input.castMemberId);
    return {
      purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
      target: { kind: 'castMember', id: input.castMemberId },
      project: projectContext,
      screenplay: buildScreenplayContext(session),
      castMember,
      activeCastDesign: activeCastDesign
        ? toCastDesignSummary({
            id: activeCastDesign.id,
            document: activeCastDesign.document,
          })
        : null,
      timePeriod: buildTimePeriodContext(session, input.castMemberId),
      activeLookbook,
      selectedAssets: assets.selectedAssets,
      characterSheetTakes: assets.characterSheetTakes,
      profileTakes: assets.profileTakes,
      imageFiles: imageFileReferences(projectFolder, [
        ...assets.selectedAssets,
        ...assets.characterSheetTakes,
        ...assets.profileTakes,
      ]),
      defaults: {
        takeCount: 1,
        seed: null,
        imageFrame: 'project',
        resolvedAspectRatio: projectContext.aspectRatio,
        detail: 'standard',
        outputFormat: 'png',
      },
      resourceKeys: studioResourceKeysForAssetTarget({
        kind: 'castMember',
        castMemberId: input.castMemberId,
      }),
    };
  });
}

export async function listCastCharacterSheetModels(
  input: CastCharacterSheetTargetInput
): Promise<CastCharacterSheetModelListReport> {
  const context = await buildCastCharacterSheetContext(input);
  return {
    purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
    target: context.target,
    models: modelChoices(context),
  };
}

export async function validateCastCharacterSheetSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastCharacterSheetGenerationSpec;
}): Promise<{ valid: true; spec: CastCharacterSheetGenerationSpec; providerPayload: Record<string, unknown> }> {
  const normalized = await normalizeSpec(input);
  const context = await buildCastCharacterSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: normalized.target.id,
  });
  const plan = buildCastCharacterSheetProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createCastCharacterSheetSpec(
  input: CastCharacterSheetSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withCastProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized, 'Cast character sheet'),
      now: new Date().toISOString(),
    });
  });
}

export async function updateCastCharacterSheetSpec(
  input: UpdateCastCharacterSheetSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withCastProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized, 'Cast character sheet'),
      now: new Date().toISOString(),
    })
  );
}

export async function readCastCharacterSheetSpec(
  input: CastCharacterSheetSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withCastProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listCastCharacterSheetSpecs(
  input: CastCharacterSheetTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withCastProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
      targetKind: 'castMember',
      targetId: input.castMemberId,
    }),
  }));
}

export async function prepareCastCharacterSheetSpec(
  input: CastCharacterSheetSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readCastCharacterSheetSpec(input);
  assertCharacterSheetSpec(specRecord.spec);
  const context = await buildCastCharacterSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: specRecord.spec.target.id,
  });
  const plan = buildCastCharacterSheetProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec, 'Cast character sheet'),
  };
}

export async function prepareCastCharacterSheetDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastCharacterSheetGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const context = await buildCastCharacterSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: normalized.target.id,
  });
  const plan = buildCastCharacterSheetProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized, 'Cast character sheet'),
  };
}

export async function buildCastCharacterSheetDependencyDraftSpec(
  input: MediaGenerationDependencyDraftSpecInput
): Promise<MediaGenerationDependencyDraftSpec> {
  if (input.dependencyTarget.kind !== 'castMember') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `cast.character-sheet dependency requires a castMember target. Received: ${input.dependencyTarget.kind}.`
    );
  }
  const context = await buildCastCharacterSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: input.dependencyTarget.id,
  });
  return {
    purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
    spec: {
      purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
      target: input.dependencyTarget,
      modelChoice: 'fal-ai/openai/gpt-image-2',
      prompt: [
        `Create a production character sheet for ${context.castMember.name}.`,
        input.reason,
        'Use the active visual language and cast design context. Keep the sheet useful as a video reference image.',
      ].join(' '),
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      detail: 'standard',
      outputFormat: 'png',
      title: input.label,
    },
    materializationState: 'generatable',
  };
}

export async function estimateCastCharacterSheetSpec(
  input: CastCharacterSheetSpecIdInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareCastCharacterSheetSpec(input);
  const { estimateGeneration } = await loadGenerationEngines();
  const estimate = await estimateGeneration(prepared.generation);
  if (estimate.estimatedCostUsd === null) {
    throw new ProjectDataError(
      'PROJECT_DATA273',
      'Generation estimate is unknown for the selected Cast character sheet model.'
    );
  }
  return { ...prepared, estimate };
}

export async function runCastCharacterSheetSpec(
  input: RunCastCharacterSheetSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareCastCharacterSheetSpec(input);
  const { estimateGeneration, runGeneration } = await loadGenerationEngines();
  const estimate = await estimateGeneration(prepared.generation);
  if (estimate.estimatedCostUsd === null) {
    throw new ProjectDataError(
      'PROJECT_DATA273',
      'Generation estimate is unknown for the selected Cast character sheet model.'
    );
  }
  const outputPaths = await resolveCastGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  return recordCastCharacterSheetRun({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate,
    approvalToken: estimate.approvalToken,
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: result.diagnostics ?? {},
    idGenerator: input.idGenerator,
  });
}

export async function recordCastCharacterSheetRun(
  input: RecordCastCharacterSheetRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readCastCharacterSheetSpec(input);
  assertCharacterSheetSpec(specRecord.spec);
  const now = new Date().toISOString();
  const run = await withCastProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationRun(session, {
      id: ids('media_generation_run'),
      specId: specRecord.id,
      spec: specRecord.spec,
      provider: input.provider,
      model: input.model,
      providerPayload: input.providerPayload,
      estimate: input.estimate,
      approvalToken: input.approvalToken,
      simulated: input.simulated,
      status: input.status,
      outputs: input.outputs,
      diagnostics: input.diagnostics,
      startedAt: now,
      completedAt: now,
    });
  });
  return { run };
}

export async function importCastCharacterSheetMedia(
  input: ImportCastCharacterSheetMediaInput
): Promise<CastMediaImportReport> {
  return importCastImageMedia(
    {
      ...input,
      purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
    },
    {
      assetType: 'character_sheet',
      assetRole: 'character_sheet',
      folderName: 'character-sheets',
      changeType: 'cast.characterSheetImported',
    }
  );
}

export function buildCastCharacterSheetProviderPayload(
  spec: CastCharacterSheetGenerationSpec,
  context: CastCharacterSheetGenerationContext
): CastProviderPlan {
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return buildGptImage2Payload(spec, context);
    case 'fal-ai/nano-banana-2':
      return buildNanoBanana2Payload(spec, context);
    case 'fal-ai/xai/grok-imagine-image':
      return buildGrokImaginePayload(spec, context);
    default:
      throw unsupportedModel(spec.modelChoice);
  }
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastCharacterSheetGenerationSpec;
}): Promise<CastCharacterSheetGenerationSpec> {
  if (input.spec.purpose !== CAST_CHARACTER_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Unsupported generation purpose: ${input.spec.purpose}.`
    );
  }
  validateCastTarget(input.spec.target);
  assertModelChoice(input.spec.modelChoice);
  const normalized = normalizeCastImageSpecControls(input.spec, 'project');
  await withCastProjectSession(input, ({ session }) => {
    requireCastMemberForContext(session, normalized.target.id);
    requireActiveLookbookContext(session);
  });
  return normalized;
}

function buildGptImage2Payload(
  spec: CastCharacterSheetGenerationSpec,
  context: CastCharacterSheetGenerationContext
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('GPT Image 2 does not support generation seed.');
  }
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2',
    mode: 'text-to-image',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      image_size: mapPresetFrame(resolveCastImageFrame(spec, context.project.aspectRatio)),
      quality: mapGptQuality(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function buildNanoBanana2Payload(
  spec: CastCharacterSheetGenerationSpec,
  context: CastCharacterSheetGenerationContext
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2',
    mode: 'text-to-image',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      seed: spec.seed ?? null,
      aspect_ratio: resolveCastImageFrame(spec, context.project.aspectRatio),
      resolution: mapNanoBananaResolution(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      safety_tolerance: '4',
      limit_generations: true,
      enable_web_search: false,
      sync_mode: false,
    },
  };
}

function buildGrokImaginePayload(
  spec: CastCharacterSheetGenerationSpec,
  context: CastCharacterSheetGenerationContext
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('Grok Imagine does not support generation seed.');
  }
  if ((spec.detail ?? 'standard') !== 'standard') {
    unsupported('Grok Imagine supports only standard detail.');
  }
  const frame = resolveCastImageFrame(spec, context.project.aspectRatio);
  if (frame === '21:9') {
    unsupported('Grok Imagine does not support exact 21:9.');
  }
  return {
    provider: 'fal-ai',
    model: 'xai/grok-imagine-image',
    mode: 'text-to-image',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      aspect_ratio: frame,
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function modelChoices(
  context: CastCharacterSheetGenerationContext
): CastImageModelChoiceReport[] {
  const aspectRatio = context.project.aspectRatio;
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: aspectRatio !== '21:9',
      ...(aspectRatio === '21:9'
        ? { unavailableReason: 'GPT Image 2 is not available for 21:9 character sheets in this slice.' }
        : {}),
      supportsSeed: false,
      requiresSourceAsset: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/nano-banana-2',
      label: 'Nano Banana 2',
      available: true,
      supportsSeed: true,
      requiresSourceAsset: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16', '21:9'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      label: 'Grok Imagine',
      available: aspectRatio !== '21:9',
      ...(aspectRatio === '21:9'
        ? { unavailableReason: 'Grok Imagine is not available for exact 21:9 character sheets.' }
        : {}),
      supportsSeed: false,
      requiresSourceAsset: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16'],
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
  ];
}

async function loadGenerationEngines() {
  return import('@gorenku/studio-engines');
}

function assertCharacterSheetSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is CastCharacterSheetGenerationSpec {
  if (spec.purpose !== CAST_CHARACTER_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
}

function assertModelChoice(
  modelChoice: string
): asserts modelChoice is CastCharacterSheetModelChoice {
  if (!CHARACTER_SHEET_MODELS.has(modelChoice)) {
    throw unsupportedModel(modelChoice);
  }
}

function unsupportedModel(modelChoice: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA289',
    `Unsupported Cast character sheet model: ${modelChoice}.`
  );
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}
