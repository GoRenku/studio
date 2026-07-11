import type {
  CastImageModelChoiceReport,
  CastMediaImportReport,
  CastProfileGenerationContext,
  CastProfileGenerationSpec,
  CastProfileModelChoice,
  CastProfileModelListReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  MediaGenerationDependencySlot,
  MediaGenerationTarget,
  PreparedMediaGeneration,
  GenerationPreviewRequestReference,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import {
  readActiveCastDesignDocument,
  toCastDesignSummary,
} from '../../database/access/department-design.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { buildSavedImageGenerationPreview } from '../../generation-preview/saved-image-preview.js';
import { studioResourceKeysForAssetTarget } from '../../studio-coordination/resource-keys.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';
import { estimateMediaGenerationSpecRecordCost } from '../cost/cost-projection.js';
import {
  requireLiveProviderApproval,
} from '../lifecycle/live-provider-approval.js';
import { declareCastProfileDependencySlots } from './cast-profile-dependency-slots.js';
import type { MediaGenerationDependencyDeclarationInput } from '../lifecycle/purpose-definition.js';
import {
  buildScreenplayContext,
  buildTimePeriodContext,
  imageFileReferences,
  importCastImageMedia,
  mapGptQuality,
  mapNanoBananaResolution,
  mapPresetFrame,
  normalizeCastImageSpecControls,
  readActiveLookbookContext,
  readCastAssetsByRole,
  readCastProjectContext,
  readSourceCharacterSheetAsset,
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

const PROFILE_MODELS = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
  'fal-ai/openai/gpt-image-2/edit',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/xai/grok-imagine-image/edit',
]);

export interface CastProfileProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface CastProfileTargetInput extends CastProfileProjectInput {
  castMemberId: string;
}

export interface CastProfileSpecFileInput extends CastProfileProjectInput {
  spec: CastProfileGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface CastProfileSpecIdInput extends CastProfileProjectInput {
  specId: string;
}

export interface UpdateCastProfileSpecInput extends CastProfileSpecIdInput {
  spec: CastProfileGenerationSpec;
}

export interface RunCastProfileSpecInput extends CastProfileSpecIdInput {
  simulate?: boolean;
  approveLiveProviderRun?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface RecordCastProfileRunInput extends CastProfileSpecIdInput {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  providerPayload: Record<string, unknown>;
  estimate: unknown;
  simulated: boolean;
  status: 'simulated' | 'completed' | 'failed';
  outputs: unknown;
  diagnostics: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface ImportCastProfileMediaInput extends CastProfileTargetInput {
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export async function buildCastProfileContext(
  input: CastProfileTargetInput
): Promise<CastProfileGenerationContext> {
  const projectContext = await readCastProjectContext(input);
  return withCastProjectSession(input, ({ session, projectFolder }) => {
    const castMember = requireCastMemberForContext(session, input.castMemberId);
    const activeLookbook = readActiveLookbookContext(session);
    const activeCastDesign = readActiveCastDesignDocument(session, input.castMemberId);
    const assets = readCastAssetsByRole(session, input.castMemberId);
    const recommendedSourceAsset =
      assets.selectedCharacterSheets[0] ?? assets.characterSheetTakes[0] ?? null;
    return {
      purpose: CAST_PROFILE_GENERATION_PURPOSE,
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
      selectedCharacterSheets: assets.selectedCharacterSheets,
      characterSheetTakes: assets.characterSheetTakes,
      profileTakes: assets.profileTakes,
      imageFiles: imageFileReferences(projectFolder, [
        ...assets.selectedAssets,
        ...assets.characterSheetTakes,
        ...assets.profileTakes,
      ]),
      recommendedSourceAssetId: recommendedSourceAsset?.assetId ?? null,
      defaults: {
        takeCount: 1,
        seed: null,
        imageFrame: '1:1',
        resolvedAspectRatio: '1:1',
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

export async function listCastProfileModels(
  input: CastProfileTargetInput
): Promise<CastProfileModelListReport> {
  const context = await buildCastProfileContext(input);
  return {
    purpose: CAST_PROFILE_GENERATION_PURPOSE,
    target: context.target,
    models: modelChoices(context),
  };
}

export async function declareCastProfileDependencies(
  input: MediaGenerationDependencyDeclarationInput
): Promise<MediaGenerationDependencySlot[]> {
  const target = requireCastMemberDependencyTarget(input.target);
  const context = await buildCastProfileContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: target.id,
  });
  return declareCastProfileDependencySlots({
    castMemberId: target.id,
    castMemberName: context.castMember.name,
  });
}

export async function validateCastProfileSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastProfileGenerationSpec;
}): Promise<{ valid: true; spec: CastProfileGenerationSpec; providerPayload: Record<string, unknown> }> {
  const normalized = await normalizeSpec(input);
  const context = await buildCastProfileContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: normalized.target.id,
  });
  const plan = buildCastProfileProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createCastProfileSpec(
  input: CastProfileSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateCastProfileSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withCastProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized, 'Cast profile'),
      now: new Date().toISOString(),
    });
  });
}

export async function updateCastProfileSpec(
  input: UpdateCastProfileSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateCastProfileSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withCastProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized, 'Cast profile'),
      now: new Date().toISOString(),
    })
  );
}

export async function readCastProfileSpec(
  input: CastProfileSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withCastProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listCastProfileSpecs(
  input: CastProfileTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withCastProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: CAST_PROFILE_GENERATION_PURPOSE,
      targetKind: 'castMember',
      targetId: input.castMemberId,
    }),
  }));
}

export async function prepareCastProfileSpec(
  input: CastProfileSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readCastProfileSpec(input);
  assertProfileSpec(specRecord.spec);
  const context = await buildCastProfileContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: specRecord.spec.target.id,
  });
  const plan = buildCastProfileProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec, 'Cast profile'),
  };
}

export async function buildCastProfileGenerationPreview(
  input: {
    projectName?: string;
    homeDir?: string;
    specRecord: MediaGenerationSpecRecord;
  }
) {
  const { specRecord } = input;
  assertProfileSpec(specRecord.spec);
  const context = await buildCastProfileContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: specRecord.spec.target.id,
  });
  const plan = buildCastProfileProviderPayload(specRecord.spec, context);
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: CAST_PROFILE_GENERATION_PURPOSE,
    project: context.project,
    target: specRecord.target,
    title: specRecord.title,
    modelChoice: specRecord.spec.modelChoice,
    modelLabel:
      modelChoices(context).find(
        (model) => model.modelChoice === specRecord.spec.modelChoice
      )?.label ?? specRecord.spec.modelChoice,
    provider: plan.provider,
    providerModel: plan.model,
    mode: plan.mode,
    authoredPrompt: specRecord.spec.prompt,
    references: castProfilePreviewReferences(specRecord.spec, context),
    payload: plan.payload,
  });
}

export async function prepareCastProfileDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastProfileGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const context = await buildCastProfileContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: normalized.target.id,
  });
  const plan = buildCastProfileProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized, 'Cast profile'),
  };
}

function castProfilePreviewReferences(
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext
): GenerationPreviewRequestReference[] {
  if (!spec.sourceAssetId) {
    return [];
  }
  const file = context.imageFiles.find(
    (candidate) => candidate.assetId === spec.sourceAssetId
  );
  if (!file) {
    return [];
  }
  return [
    {
      kind: 'image',
      role: 'cast-profile-source-image',
      label: 'Cast profile source image',
      providerToken: 'image_urls',
      assetId: file.assetId,
      assetFileId: file.assetFileId,
      sourcePurpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
      selected: true,
    },
  ];
}

export async function runCastProfileSpec(
  input: RunCastProfileSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareCastProfileSpec(input);
  const { runGeneration } = await loadGenerationEngines();
  const estimate = await estimateMediaGenerationSpecRecordCost(prepared.spec);
  const mode = input.simulate ? 'simulated' : 'live';
  requireLiveProviderApproval({
    mode,
    approveLiveProviderRun: input.approveLiveProviderRun,
    specId: prepared.spec.id,
    purpose: prepared.spec.purpose,
  });
  const outputPaths = await resolveCastGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  return recordCastProfileRun({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate,
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: result.diagnostics ?? {},
    idGenerator: input.idGenerator,
  });
}

export async function recordCastProfileRun(
  input: RecordCastProfileRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readCastProfileSpec(input);
  assertProfileSpec(specRecord.spec);
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

export async function importCastProfileMedia(
  input: ImportCastProfileMediaInput
): Promise<CastMediaImportReport> {
  return importCastImageMedia(
    {
      ...input,
      purpose: CAST_PROFILE_GENERATION_PURPOSE,
    },
    {
      assetType: 'cast_profile',
      assetRole: 'profile',
      folderName: 'profiles',
      changeType: 'cast.profileImported',
    }
  );
}

export function buildCastProfileProviderPayload(
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext
): CastProviderPlan {
  const sourcePath = resolveSourcePathForEditModel(spec, context);
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return buildGptImage2Payload(spec, context);
    case 'fal-ai/nano-banana-2':
      return buildNanoBanana2Payload(spec, context);
    case 'fal-ai/xai/grok-imagine-image':
      return buildGrokImaginePayload(spec, context);
    case 'fal-ai/openai/gpt-image-2/edit':
      return buildGptImage2EditPayload(spec, context, sourcePath);
    case 'fal-ai/nano-banana-2/edit':
      return buildNanoBanana2EditPayload(spec, context, sourcePath);
    case 'fal-ai/xai/grok-imagine-image/edit':
      return buildGrokImagineEditPayload(spec, sourcePath);
    default:
      throw unsupportedModel(spec.modelChoice);
  }
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: CastProfileGenerationSpec;
}): Promise<CastProfileGenerationSpec> {
  if (input.spec.purpose !== CAST_PROFILE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Unsupported generation purpose: ${input.spec.purpose}.`
    );
  }
  validateCastTarget(input.spec.target);
  assertModelChoice(input.spec.modelChoice);
  if (isGrokImagineEditModel(input.spec.modelChoice) && hasImageFrameProperty(input.spec)) {
    unsupported(
      'Grok Imagine edit does not support imageFrame because the provider edit endpoint cannot control output frame.'
    );
  }
  const normalizedWithControls = normalizeCastImageSpecControls(input.spec, '1:1');
  const normalized = isGrokImagineEditModel(normalizedWithControls.modelChoice)
    ? withoutImageFrame(normalizedWithControls)
    : normalizedWithControls;
  await withCastProjectSession(input, ({ session }) => {
    requireCastMemberForContext(session, normalized.target.id);
    if (isEditModel(normalized.modelChoice)) {
      if (!normalized.sourceAssetId) {
        throw new ProjectDataError(
          'PROJECT_DATA290',
          'Cast profile edit generation requires sourceAssetId.'
        );
      }
      readSourceCharacterSheetAsset(session, {
        castMemberId: normalized.target.id,
        sourceAssetId: normalized.sourceAssetId,
      });
    } else if (normalized.sourceAssetId) {
      throw new ProjectDataError(
        'PROJECT_DATA291',
        'Cast profile text-to-image generation must not include sourceAssetId.'
      );
    }
  });
  return normalized;
}

function requireCastMemberDependencyTarget(
  target: MediaGenerationTarget
): Extract<MediaGenerationTarget, { kind: 'castMember' }> {
  if (target.kind !== 'castMember') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `cast.profile dependency planning requires a castMember target. Received: ${target.kind}.`
    );
  }
  return target;
}

function resolveSourcePathForEditModel(
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext
): string | null {
  if (!isEditModel(spec.modelChoice)) {
    return null;
  }
  if (!spec.sourceAssetId) {
    throw new ProjectDataError(
      'PROJECT_DATA290',
      'Cast profile edit generation requires sourceAssetId.'
    );
  }
  const sourceFile = context.imageFiles.find(
    (file) => file.assetId === spec.sourceAssetId
  );
  if (!sourceFile) {
    throw new ProjectDataError(
      'PROJECT_DATA293',
      `Cast profile source asset has no image file in generation context: ${spec.sourceAssetId}.`
    );
  }
  return sourceFile.projectRelativePath;
}

function buildGptImage2Payload(
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext
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
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext
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
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext
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

function buildGptImage2EditPayload(
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext,
  sourcePath: string | null
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('GPT Image 2 edit does not support generation seed.');
  }
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2/edit',
    mode: 'image-edit',
    outputCount: takeCount,
    inputFiles: sourceInputFiles(sourcePath),
    payload: {
      prompt: spec.prompt,
      image_urls: sourceLogicalInput(sourcePath),
      num_images: takeCount,
      image_size: mapPresetFrame(resolveCastImageFrame(spec, context.project.aspectRatio)),
      quality: mapGptQuality(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function buildNanoBanana2EditPayload(
  spec: CastProfileGenerationSpec,
  context: CastProfileGenerationContext,
  sourcePath: string | null
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2/edit',
    mode: 'image-edit',
    outputCount: takeCount,
    inputFiles: sourceInputFiles(sourcePath),
    payload: {
      prompt: spec.prompt,
      image_urls: sourceLogicalInput(sourcePath),
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

function buildGrokImagineEditPayload(
  spec: CastProfileGenerationSpec,
  sourcePath: string | null
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (hasImageFrameProperty(spec)) {
    unsupported(
      'Grok Imagine edit does not support imageFrame because the provider edit endpoint cannot control output frame.'
    );
  }
  if (spec.seed !== null) {
    unsupported('Grok Imagine edit does not support generation seed.');
  }
  if ((spec.detail ?? 'standard') !== 'standard') {
    unsupported('Grok Imagine edit supports only standard detail.');
  }
  return {
    provider: 'fal-ai',
    model: 'xai/grok-imagine-image/edit',
    mode: 'image-edit',
    outputCount: takeCount,
    inputFiles: sourceInputFiles(sourcePath),
    payload: {
      prompt: spec.prompt,
      image_urls: sourceLogicalInput(sourcePath),
      num_images: takeCount,
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function sourceInputFiles(sourcePath: string | null): CastProviderPlan['inputFiles'] {
  if (!sourcePath) {
    throw new ProjectDataError(
      'PROJECT_DATA290',
      'Cast profile edit generation requires sourceAssetId.'
    );
  }
  return [
    {
      field: 'image_urls',
      projectRelativePath: sourcePath,
      mediaKind: 'image',
      asArray: true,
      required: true,
    },
  ];
}

function sourceLogicalInput(sourcePath: string | null): string[] {
  if (!sourcePath) {
    throw new ProjectDataError(
      'PROJECT_DATA290',
      'Cast profile edit generation requires sourceAssetId.'
    );
  }
  return [`renku-input://${encodeURI(sourcePath)}`];
}

function modelChoices(context: CastProfileGenerationContext): CastImageModelChoiceReport[] {
  const aspectRatio = context.project.aspectRatio;
  const hasSource =
    (context.selectedCharacterSheets[0] ?? context.characterSheetTakes[0]) !== undefined;
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: true,
      supportsSeed: false,
      supportsImageReferences: false,
      maxImageReferences: 0,
      requiresSourceAsset: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: profilePresetFrames(aspectRatio),
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/nano-banana-2',
      label: 'Nano Banana 2',
      available: true,
      supportsSeed: true,
      supportsImageReferences: false,
      maxImageReferences: 0,
      requiresSourceAsset: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16', '21:9'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      label: 'Grok Imagine',
      available: true,
      supportsSeed: false,
      supportsImageReferences: false,
      maxImageReferences: 0,
      requiresSourceAsset: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: profilePresetFrames(aspectRatio),
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    editChoice(
      'fal-ai/openai/gpt-image-2/edit',
      'GPT Image 2 Edit',
      hasSource,
      false,
      profilePresetFrames(aspectRatio)
    ),
    editChoice(
      'fal-ai/nano-banana-2/edit',
      'Nano Banana 2 Edit',
      hasSource,
      true,
      profileNanoFrames()
    ),
    editChoice(
      'fal-ai/xai/grok-imagine-image/edit',
      'Grok Imagine Edit',
      hasSource,
      false,
      []
    ),
  ];
}

function editChoice(
  modelChoice: CastProfileModelChoice,
  label: string,
  hasSource: boolean,
  supportsSeed: boolean,
  supportedFrames: CastImageModelChoiceReport['supportedFrames']
): CastImageModelChoiceReport {
  return {
    modelChoice,
    label,
    available: hasSource,
    ...(hasSource
      ? {}
      : { unavailableReason: 'Edit profile models require a character sheet source asset.' }),
    supportsSeed,
    supportsImageReferences: false,
    maxImageReferences: 0,
    requiresSourceAsset: true,
    takeCount: { min: 1, max: 4, default: 1 },
    supportedFrames,
    supportedDetails:
      modelChoice === 'fal-ai/xai/grok-imagine-image/edit'
        ? ['standard']
        : ['draft', 'standard', 'high'],
    supportedOutputFormats: ['png', 'jpeg', 'webp'],
  };
}

function profilePresetFrames(
  projectAspectRatio: string | null
): CastImageModelChoiceReport['supportedFrames'] {
  const frames: CastImageModelChoiceReport['supportedFrames'] = [
    '1:1',
    '3:4',
    '4:3',
    '16:9',
    '9:16',
  ];
  return projectAspectRatio === '21:9' ? frames : ['project', ...frames];
}

function profileNanoFrames(): CastImageModelChoiceReport['supportedFrames'] {
  return ['project', '1:1', '3:4', '4:3', '16:9', '9:16', '21:9'];
}

async function loadGenerationEngines() {
  return import('@gorenku/studio-engines');
}

function isEditModel(modelChoice: CastProfileModelChoice): boolean {
  return modelChoice.endsWith('/edit');
}

function isGrokImagineEditModel(modelChoice: CastProfileModelChoice): boolean {
  return modelChoice === 'fal-ai/xai/grok-imagine-image/edit';
}

function hasImageFrameProperty(spec: CastProfileGenerationSpec): boolean {
  return Object.prototype.hasOwnProperty.call(spec, 'imageFrame');
}

function withoutImageFrame(spec: CastProfileGenerationSpec): CastProfileGenerationSpec {
  const normalized = { ...spec };
  delete normalized.imageFrame;
  return normalized;
}

function assertProfileSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is CastProfileGenerationSpec {
  if (spec.purpose !== CAST_PROFILE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
}

function assertModelChoice(
  modelChoice: string
): asserts modelChoice is CastProfileModelChoice {
  if (!PROFILE_MODELS.has(modelChoice)) {
    throw unsupportedModel(modelChoice);
  }
}

function unsupportedModel(modelChoice: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA292',
    `Unsupported Cast profile model: ${modelChoice}.`
  );
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}
