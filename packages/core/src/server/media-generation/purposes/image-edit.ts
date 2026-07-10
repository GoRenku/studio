import type {
  Asset,
  AssetFile,
  GenerationPreviewRequestReference,
  ImageEditGenerationContext,
  ImageEditGenerationSpec,
  ImageEditModelChoice,
  ImageEditModelChoiceReport,
  ImageEditModelListReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  IMAGE_EDIT_GENERATION_PURPOSE,
} from '../../../client/index.js';
import {
  listAssetFileRecordsForAsset,
} from '../../database/access/asset-files.js';
import {
  readAssetRecord,
} from '../../database/access/assets.js';
import {
  insertMediaGenerationSpec,
  listMediaGenerationRuns,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import {
  readProjectRecord,
} from '../../database/access/project.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../../entity-ids.js';
import {
  normalizeProjectRelativePath,
} from '../../files/project-relative-paths.js';
import {
  allocateImageEditOutputNames,
} from '../../project-asset-files/index.js';
import {
  providerPreviewPromptText,
} from '../../generation-preview/provider-preview-prompt.js';
import {
  buildSavedImageGenerationPreview,
} from '../../generation-preview/saved-image-preview.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { readAgentMediaExecutionPolicy } from '../../renku-config.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';
import {
  withMediaGenerationProjectSession,
} from '../lifecycle/project-session.js';

const IMAGE_EDIT_MODELS = new Set<ImageEditModelChoice>([
  'fal-ai/openai/gpt-image-2/edit',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/xai/grok-imagine-image/edit',
]);

const OUTPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);
const GPT_QUALITIES = new Set(['low', 'medium', 'high']);
const NANO_RESOLUTIONS = new Set(['1K', '2K', '4K']);
const NANO_ASPECT_RATIOS = new Set([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
]);

interface ImageEditProviderPlan {
  provider: 'fal-ai';
  model: 'openai/gpt-image-2/edit' | 'nano-banana-2/edit' | 'xai/grok-imagine-image/edit';
  mode: 'image-edit';
  payload: Record<string, unknown>;
  inputFiles: NonNullable<PreparedMediaGeneration['generation']['request']['inputFiles']>;
  sourceAssetFileId: string;
  outputCount: number;
  outputNames: string[];
}

interface ImageEditSourceAsset {
  asset: Asset;
  files: AssetFile[];
  imageFiles: AssetFile[];
}

export interface ImageEditProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface ImageEditTargetInput extends ImageEditProjectInput {
  assetId: string;
}

export interface ImageEditSpecFileInput extends ImageEditProjectInput {
  spec: ImageEditGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface ImageEditSpecIdInput extends ImageEditProjectInput {
  specId: string;
}

export interface UpdateImageEditSpecInput extends ImageEditSpecIdInput {
  spec: ImageEditGenerationSpec;
}

export async function buildImageEditContext(
  input: ImageEditTargetInput
): Promise<ImageEditGenerationContext> {
  const agentMedia = await buildImageEditAgentMediaReport(input);
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const source = loadImageEditSourceAsset(session, input.assetId);
    requireSourceImageFiles(source.imageFiles, input.assetId);
    const selectedSourceFile =
      source.imageFiles.length === 1 ? source.imageFiles[0] ?? null : null;
    const selectedSourceAssetFileId =
      selectedSourceFile?.id ?? null;
    const sourceGeneration = selectedSourceFile
      ? readSourceGeneration(session, selectedSourceFile.projectRelativePath)
      : null;
    return {
      purpose: IMAGE_EDIT_GENERATION_PURPOSE,
      target: { kind: 'asset', id: input.assetId },
      sourceAsset: source.asset,
      sourceImageFiles: source.imageFiles,
      selectedSourceAssetFileId,
      recommendedModelChoice:
        sourceGeneration?.mappedEditModelChoice ?? 'fal-ai/openai/gpt-image-2/edit',
      ...(sourceGeneration ? { sourceGeneration } : {}),
      agentMedia,
    };
  });
}

export async function listImageEditModels(
  input: ImageEditTargetInput
): Promise<ImageEditModelListReport> {
  await buildImageEditContext(input);
  return {
    purpose: IMAGE_EDIT_GENERATION_PURPOSE,
    target: { kind: 'asset', id: input.assetId },
    models: imageEditModelChoices(),
  };
}

export async function validateImageEditSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageEditGenerationSpec;
}): Promise<{
  valid: true;
  spec: ImageEditGenerationSpec;
  providerPayload: Record<string, unknown>;
}> {
  const normalized = await normalizeSpec(input);
  const plan = await prepareImageEditProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createImageEditSpec(
  input: ImageEditSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateImageEditSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized),
      now: new Date().toISOString(),
    });
  });
}

export async function updateImageEditSpec(
  input: UpdateImageEditSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateImageEditSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withMediaGenerationProjectSession(input, ({ session }) => {
    requireMediaGenerationSpec(session, input.specId);
    return updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized),
      now: new Date().toISOString(),
    });
  });
}

export async function listImageEditSpecs(
  input: ImageEditTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withMediaGenerationProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: IMAGE_EDIT_GENERATION_PURPOSE,
      targetKind: 'asset',
      targetId: input.assetId,
    }),
  }));
}

export async function prepareImageEditSpec(
  input: ImageEditSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readImageEditSpec(input);
  assertImageEditSpec(specRecord.spec);
  const plan = await prepareImageEditProviderPlan({
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

export async function prepareImageEditDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageEditGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const plan = await prepareImageEditProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

export async function buildImageEditGenerationPreview(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}) {
  const { specRecord } = input;
  assertImageEditSpec(specRecord.spec);
  const plan = await prepareImageEditProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: specRecord.spec,
  });
  const project = await readImageEditProject(input);
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: IMAGE_EDIT_GENERATION_PURPOSE,
    project,
    target: specRecord.target,
    title: specRecord.title,
    modelChoice: specRecord.spec.modelChoice,
    modelLabel:
      imageEditModelChoices().find(
        (model) => model.modelChoice === specRecord.spec.modelChoice
      )?.label ?? specRecord.spec.modelChoice,
    provider: plan.provider,
    providerModel: plan.model,
    mode: plan.mode,
    authoredPrompt: specRecord.spec.prompt,
    providerPrompt: providerPreviewPromptText(plan.payload, specRecord.spec.prompt),
    references: imageEditPreviewReferences(specRecord.spec, plan),
    payload: plan.payload,
  });
}

export async function runImageEditSpec(
  input: ImageEditSpecIdInput & {
    simulate?: boolean;
    approveLiveProviderRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<MediaGenerationRunReport> {
  throw new ProjectDataError(
    'CORE_IMAGE_EDIT_RUN_USE_SHARED_LIFECYCLE',
    `Image edit runs use the shared media generation lifecycle: ${input.specId}.`
  );
}

async function readImageEditSpec(
  input: ImageEditSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageEditGenerationSpec;
}): Promise<ImageEditGenerationSpec> {
  if (input.spec.purpose !== IMAGE_EDIT_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_PURPOSE_UNSUPPORTED',
      `Unsupported image edit generation purpose: ${input.spec.purpose}.`
    );
  }
  if (input.spec.target?.kind !== 'asset' || !input.spec.target.id) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_ASSET_MISSING',
      'Image edit generation requires an asset target.'
    );
  }
  if (!IMAGE_EDIT_MODELS.has(input.spec.modelChoice)) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_MODEL_UNSUPPORTED',
      `Unsupported image edit model choice: ${input.spec.modelChoice}.`
    );
  }
  const prompt = input.spec.prompt?.trim() ?? '';
  if (!prompt) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_PROMPT_REQUIRED',
      'Image edit generation requires a non-empty prompt.'
    );
  }
  const parameterValues = normalizeParameterValues(
    input.spec.modelChoice,
    input.spec.parameterValues ?? {}
  );
  await withMediaGenerationProjectSession(input, ({ session }) => {
    const source = loadImageEditSourceAsset(session, input.spec.target.id);
    requireSelectedImageEditSourceFile(source, {
      assetId: input.spec.target.id,
      sourceAssetFileId: input.spec.sourceAssetFileId,
    });
  });
  return {
    purpose: IMAGE_EDIT_GENERATION_PURPOSE,
    target: { kind: 'asset', id: input.spec.target.id },
    ...(input.spec.sourceAssetFileId
      ? { sourceAssetFileId: input.spec.sourceAssetFileId }
      : {}),
    modelChoice: input.spec.modelChoice,
    prompt,
    parameterValues,
    ...(input.spec.title?.trim() ? { title: input.spec.title.trim() } : {}),
  };
}

async function prepareImageEditProviderPlan(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageEditGenerationSpec;
}): Promise<ImageEditProviderPlan> {
  return withMediaGenerationProjectSession(input, async ({ session, projectFolder }) => {
    const source = loadImageEditSourceAsset(session, input.spec.target.id);
    const selectedFile = requireSelectedImageEditSourceFile(source, {
      assetId: input.spec.target.id,
      sourceAssetFileId: input.spec.sourceAssetFileId,
    });
    return buildProviderPayload(input.spec, selectedFile, projectFolder, session);
  });
}

function loadImageEditSourceAsset(
  session: DatabaseSession,
  assetId: string
): ImageEditSourceAsset {
  const record = readAssetRecord(session, assetId);
  if (!record || record.discardedAt) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_ASSET_MISSING',
      `Image edit source asset was not found: ${assetId}.`
    );
  }
  const files = listAssetFileRecordsForAsset(session, assetId).map((file) => ({
    id: file.id,
    role: file.role,
    projectRelativePath: normalizeProjectRelativePath(file.projectRelativePath),
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    contentHash: file.contentHash,
    width: file.width,
    height: file.height,
    durationSeconds: file.durationSeconds,
  }));
  const imageFiles = files.filter((file) => file.mediaKind === 'image');
  return {
    asset: {
      assetId: record.id,
      relationshipId: record.id,
      target: { kind: 'project' },
      localeId: null,
      type: record.type,
      selection: { kind: 'take' },
      availability: 'ready',
      mediaKind: record.mediaKind,
      title: record.title,
      oneLineSummary: record.oneLineSummary,
      origin: record.origin,
      role: record.type,
      referenceName: null,
      purpose: null,
      sortOrder: 0,
      files,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    files,
    imageFiles,
  };
}

function requireSelectedImageEditSourceFile(
  source: ImageEditSourceAsset,
  input: { assetId: string; sourceAssetFileId?: string }
): AssetFile {
  if (input.sourceAssetFileId) {
    const requested = source.files.find((file) => file.id === input.sourceAssetFileId);
    if (requested && requested.mediaKind !== 'image') {
      throw new ProjectDataError(
        'CORE_IMAGE_EDIT_SOURCE_FILE_NOT_IMAGE',
        `Image edit source file must be an image file: ${input.sourceAssetFileId}.`
      );
    }
  }
  requireSourceImageFiles(source.imageFiles, input.assetId);
  return selectSourceImageFile(source.imageFiles, input);
}

function requireSourceImageFiles(imageFiles: AssetFile[], assetId: string): void {
  if (imageFiles.length === 0) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_FILE_MISSING',
      `Image edit source asset has no active image files: ${assetId}.`
    );
  }
}

function selectSourceImageFile(
  imageFiles: AssetFile[],
  input: { assetId: string; sourceAssetFileId?: string }
): AssetFile {
  if (input.sourceAssetFileId) {
    const selected = imageFiles.find((file) => file.id === input.sourceAssetFileId);
    if (!selected) {
      throw new ProjectDataError(
        'CORE_IMAGE_EDIT_SOURCE_FILE_MISSING',
        `Image edit source file must be an active image file on asset ${input.assetId}: ${input.sourceAssetFileId}.`
      );
    }
    return selected;
  }
  if (imageFiles.length !== 1) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_FILE_AMBIGUOUS',
      `Image edit source asset has ${imageFiles.length} active image files. Choose sourceAssetFileId explicitly.`
    );
  }
  return imageFiles[0]!;
}

async function buildProviderPayload(
  spec: ImageEditGenerationSpec,
  sourceFile: AssetFile,
  projectFolder: string,
  session: DatabaseSession
): Promise<ImageEditProviderPlan> {
  const sourcePath = sourceFile.projectRelativePath;
  const inputFiles: ImageEditProviderPlan['inputFiles'] = [
    {
      field: 'image_urls',
      projectRelativePath: sourcePath,
      mediaKind: 'image',
      asArray: true,
      required: true,
    },
  ];
  const basePayload = {
    prompt: spec.prompt,
    image_urls: [logicalInputUrl(sourcePath)],
    sync_mode: false,
  };
  const outputCount = outputCountFromParameters(spec.parameterValues);
  const outputNames = await allocateImageEditOutputNames({
    session,
    projectFolder,
    sourceAssetId: spec.target.id,
    sourceAssetFileId: sourceFile.id,
    outputFormat: String(spec.parameterValues.output_format ?? 'png'),
    outputCount,
  });
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2/edit':
      return {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        mode: 'image-edit',
        outputCount,
        inputFiles,
        sourceAssetFileId: sourceFile.id,
        outputNames,
        payload: {
          ...basePayload,
          ...spec.parameterValues,
          num_images: outputCount,
        },
      };
    case 'fal-ai/nano-banana-2/edit':
      return {
        provider: 'fal-ai',
        model: 'nano-banana-2/edit',
        mode: 'image-edit',
        outputCount,
        inputFiles,
        sourceAssetFileId: sourceFile.id,
        outputNames,
        payload: {
          ...basePayload,
          safety_tolerance: '4',
          limit_generations: true,
          enable_web_search: false,
          ...spec.parameterValues,
          num_images: outputCount,
        },
      };
    case 'fal-ai/xai/grok-imagine-image/edit':
      return {
        provider: 'fal-ai',
        model: 'xai/grok-imagine-image/edit',
        mode: 'image-edit',
        outputCount,
        inputFiles,
        sourceAssetFileId: sourceFile.id,
        outputNames,
        payload: {
          ...basePayload,
          ...spec.parameterValues,
          num_images: outputCount,
        },
      };
    default:
      throw new ProjectDataError(
        'CORE_IMAGE_EDIT_MODEL_UNSUPPORTED',
        `Unsupported image edit model choice: ${spec.modelChoice}.`
      );
  }
}

function toGenerationRequest(
  plan: ImageEditProviderPlan,
  spec: ImageEditGenerationSpec
): PreparedMediaGeneration['generation'] {
  const { prompt, ...parameters } = plan.payload;
  return {
    policy: {
      provider: plan.provider,
      model: plan.model,
      mediaKind: 'image',
      mode: plan.mode,
      outputCount: plan.outputCount,
    },
    request: {
      prompt: typeof prompt === 'string' ? prompt : spec.prompt,
      inputFiles: plan.inputFiles,
      pricingInputCounts: { image: 1 },
      parameters,
      outputNames: plan.outputNames,
    },
  };
}

function logicalInputUrl(projectRelativePath: ProjectRelativePath): string {
  return `renku-input://${encodeURI(projectRelativePath)}`;
}

function normalizeParameterValues(
  modelChoice: ImageEditModelChoice,
  parameterValues: Record<string, unknown>
): Record<string, unknown> {
  const allowed = allowedParameterKeys(modelChoice);
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameterValues)) {
    if (!allowed.has(key)) {
      throw new ProjectDataError(
        'CORE_IMAGE_EDIT_PARAMETERS_UNSUPPORTED',
        `Image edit model ${modelChoice} does not support parameter "${key}".`
      );
    }
    normalized[key] = normalizeParameterValue(modelChoice, key, value);
  }
  if (!('output_format' in normalized)) {
    normalized.output_format = 'png';
  }
  if (!('num_images' in normalized)) {
    normalized.num_images = 1;
  }
  return normalized;
}

function normalizeParameterValue(
  modelChoice: ImageEditModelChoice,
  key: string,
  value: unknown
): unknown {
  if (key === 'num_images') {
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 4) {
      throw unsupportedParameter(modelChoice, key, 'must be an integer from 1 to 4');
    }
    return value;
  }
  if (key === 'output_format') {
    if (typeof value !== 'string' || !OUTPUT_FORMATS.has(value)) {
      throw unsupportedParameter(modelChoice, key, 'must be png, jpeg, or webp');
    }
    return value;
  }
  if (key === 'quality') {
    if (typeof value !== 'string' || !GPT_QUALITIES.has(value)) {
      throw unsupportedParameter(modelChoice, key, 'must be low, medium, or high');
    }
    return value;
  }
  if (key === 'image_size') {
    if (!isImageSize(value)) {
      throw unsupportedParameter(
        modelChoice,
        key,
        'must be an object with positive integer width and height'
      );
    }
    return value;
  }
  if (key === 'resolution') {
    if (typeof value !== 'string' || !NANO_RESOLUTIONS.has(value)) {
      throw unsupportedParameter(modelChoice, key, 'must be 1K, 2K, or 4K');
    }
    return value;
  }
  if (key === 'aspect_ratio') {
    if (typeof value !== 'string' || !NANO_ASPECT_RATIOS.has(value)) {
      throw unsupportedParameter(modelChoice, key, 'is not supported');
    }
    return value;
  }
  if (key === 'seed') {
    if (value !== null && (!Number.isInteger(value) || Number(value) < 0)) {
      throw unsupportedParameter(
        modelChoice,
        key,
        'must be a non-negative integer or null'
      );
    }
    return value;
  }
  return value;
}

function allowedParameterKeys(modelChoice: ImageEditModelChoice): Set<string> {
  switch (modelChoice) {
    case 'fal-ai/openai/gpt-image-2/edit':
      return new Set(['image_size', 'quality', 'output_format', 'num_images']);
    case 'fal-ai/nano-banana-2/edit':
      return new Set([
        'aspect_ratio',
        'resolution',
        'output_format',
        'seed',
        'num_images',
      ]);
    case 'fal-ai/xai/grok-imagine-image/edit':
      return new Set(['output_format', 'num_images']);
    default:
      return new Set();
  }
}

function unsupportedParameter(
  modelChoice: ImageEditModelChoice,
  key: string,
  reason: string
): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_PARAMETERS_UNSUPPORTED',
    `Image edit parameter "${key}" for ${modelChoice} ${reason}.`
  );
}

function isImageSize(value: unknown): value is { width: number; height: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const size = value as { width?: unknown; height?: unknown };
  return (
    Number.isInteger(size.width) &&
    Number(size.width) > 0 &&
    Number.isInteger(size.height) &&
    Number(size.height) > 0
  );
}

function outputCountFromParameters(parameterValues: Record<string, unknown>): number {
  return Number(parameterValues.num_images ?? 1);
}

function imageEditPreviewReferences(
  spec: ImageEditGenerationSpec,
  plan: ImageEditProviderPlan
): GenerationPreviewRequestReference[] {
  return [
    {
      kind: 'image',
      role: 'image-edit-source',
      label: 'Image edit source',
      providerToken: 'image_urls',
      assetId: spec.target.id,
      assetFileId: plan.sourceAssetFileId,
      selected: true,
    },
  ];
}

function imageEditModelChoices(): ImageEditModelChoiceReport[] {
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2/edit',
      label: 'GPT Image 2 Edit',
      available: true,
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      mediaKind: 'image',
      mode: 'image-edit',
      supportsSeed: false,
      sourceImageCount: { min: 1, max: 1, required: true },
      defaultParameterValues: {
        image_size: { width: 1024, height: 768 },
        quality: 'high',
        output_format: 'png',
        num_images: 1,
      },
      parameterRows: [
        { key: 'image_size', label: 'Image size', required: false },
        { key: 'quality', label: 'Quality', required: false, allowedValues: [...GPT_QUALITIES] },
        { key: 'output_format', label: 'Output format', required: false, allowedValues: [...OUTPUT_FORMATS] },
        { key: 'num_images', label: 'Images', required: false, minimum: 1, maximum: 4 },
      ],
    },
    {
      modelChoice: 'fal-ai/nano-banana-2/edit',
      label: 'Nano Banana 2 Edit',
      available: true,
      provider: 'fal-ai',
      model: 'nano-banana-2/edit',
      mediaKind: 'image',
      mode: 'image-edit',
      supportsSeed: true,
      sourceImageCount: { min: 1, max: 1, required: true },
      defaultParameterValues: {
        aspect_ratio: '4:3',
        resolution: '1K',
        output_format: 'png',
        seed: null,
        num_images: 1,
      },
      parameterRows: [
        { key: 'aspect_ratio', label: 'Aspect ratio', required: false, allowedValues: [...NANO_ASPECT_RATIOS] },
        { key: 'resolution', label: 'Resolution', required: false, allowedValues: [...NANO_RESOLUTIONS] },
        { key: 'output_format', label: 'Output format', required: false, allowedValues: [...OUTPUT_FORMATS] },
        { key: 'seed', label: 'Seed', required: false, minimum: 0 },
        { key: 'num_images', label: 'Images', required: false, minimum: 1, maximum: 4 },
      ],
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
      label: 'Grok Imagine Edit',
      available: true,
      provider: 'fal-ai',
      model: 'xai/grok-imagine-image/edit',
      mediaKind: 'image',
      mode: 'image-edit',
      supportsSeed: false,
      sourceImageCount: { min: 1, max: 1, required: true },
      defaultParameterValues: {
        output_format: 'png',
        num_images: 1,
      },
      parameterRows: [
        { key: 'output_format', label: 'Output format', required: false, allowedValues: [...OUTPUT_FORMATS] },
        { key: 'num_images', label: 'Images', required: false, minimum: 1, maximum: 4 },
      ],
    },
  ];
}

function readSourceGeneration(
  session: DatabaseSession,
  projectRelativePath: ProjectRelativePath
): ImageEditGenerationContext['sourceGeneration'] | null {
  for (const run of listMediaGenerationRuns(session)) {
    if (!runOutputsContainProjectRelativePath(run.outputs, projectRelativePath)) {
      continue;
    }
    const mappedEditModelChoice = mapSourceModelToEditChoice(run.model);
    return {
      runId: run.id,
      provider: run.provider,
      model: run.model,
      ...(mappedEditModelChoice ? { mappedEditModelChoice } : {}),
    };
  }
  return null;
}

function runOutputsContainProjectRelativePath(
  value: unknown,
  projectRelativePath: ProjectRelativePath
): boolean {
  if (Array.isArray(value)) {
    return value.some((item) =>
      runOutputsContainProjectRelativePath(item, projectRelativePath)
    );
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.projectRelativePath === projectRelativePath) {
    return true;
  }
  return Object.values(record).some((item) =>
    runOutputsContainProjectRelativePath(item, projectRelativePath)
  );
}

function mapSourceModelToEditChoice(
  model: string
): ImageEditModelChoice | undefined {
  switch (model) {
    case 'openai/gpt-image-2':
    case 'openai/gpt-image-2/edit':
      return 'fal-ai/openai/gpt-image-2/edit';
    case 'nano-banana-2':
    case 'nano-banana-2/edit':
      return 'fal-ai/nano-banana-2/edit';
    case 'xai/grok-imagine-image':
    case 'xai/grok-imagine-image/edit':
      return 'fal-ai/xai/grok-imagine-image/edit';
    default:
      return undefined;
  }
}

async function readImageEditProject(input: ImageEditProjectInput) {
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'CORE_IMAGE_EDIT_PROJECT_MISSING',
        'Image edit generation requires an active project.'
      );
    }
    return {
      id: project.id,
      name: project.name,
      title: project.title,
    };
  });
}

async function buildImageEditAgentMediaReport(input: ImageEditProjectInput) {
  const policy = await readAgentMediaExecutionPolicy({ homeDir: input.homeDir });
  return {
    imageGeneration: {
      defaultExecutionPath: policy.imageGeneration.defaultExecutionPath,
      appliesToPurpose: true,
      renkuManagedAvailable: true,
      externalBuiltInGeneration: {
        preferred: 'codex.gpt-image-2' as const,
        availableInRenku: false as const,
        requiresHarnessTool: true as const,
      },
    },
  };
}

function titleForSpec(spec: ImageEditGenerationSpec): string {
  return spec.title?.trim() || 'Image edit';
}

function assertImageEditSpec(
  spec: unknown
): asserts spec is ImageEditGenerationSpec {
  if (
    !spec ||
    typeof spec !== 'object' ||
    (spec as ImageEditGenerationSpec).purpose !== IMAGE_EDIT_GENERATION_PURPOSE
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_PURPOSE_UNSUPPORTED',
      'Media generation spec is not an image.edit spec.'
    );
  }
}
