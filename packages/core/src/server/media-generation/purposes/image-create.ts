import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AssetFile,
  GenerationReferenceFileInput,
  GenerationPreviewRequestReference,
  ImageCreateGenerationContext,
  ImageCreateGenerationSpec,
  ImageCreateMode,
  ImageCreateModelChoice,
  ImageCreateModelChoiceReport,
  ImageCreateModelListReport,
  ImageCreateReferenceImage,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  IMAGE_CREATE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import {
  readAssetFileRecord,
} from '../../database/access/asset-files.js';
import {
  readAssetRecord,
} from '../../database/access/assets.js';
import {
  insertMediaGenerationSpec,
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
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
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

const IMAGE_CREATE_MODELS = new Set<ImageCreateModelChoice>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

const IMAGE_CREATE_REFERENCE_IMAGE_MAX_COUNTS = {
  'fal-ai/openai/gpt-image-2': 10,
  'fal-ai/nano-banana-2': 10,
  'fal-ai/xai/grok-imagine-image': 3,
} satisfies Record<ImageCreateModelChoice, number>;
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

interface ImageCreateProviderPlan {
  provider: 'fal-ai';
  model:
    | 'openai/gpt-image-2'
    | 'openai/gpt-image-2/edit'
    | 'nano-banana-2'
    | 'nano-banana-2/edit'
    | 'xai/grok-imagine-image'
    | 'xai/grok-imagine-image/edit';
  mode: ImageCreateMode;
  payload: Record<string, unknown>;
  inputFiles?: NonNullable<PreparedMediaGeneration['generation']['request']['inputFiles']>;
  referenceImages: ResolvedImageCreateReferenceImage[];
  referenceFileCount: number;
  outputCount: number;
}

interface ImageCreateProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface ImageCreateTargetInput extends ImageCreateProjectInput {
  projectId?: string;
}

export interface ImageCreateSpecFileInput extends ImageCreateProjectInput {
  spec: ImageCreateGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface ImageCreateSpecIdInput extends ImageCreateProjectInput {
  specId: string;
}

export interface UpdateImageCreateSpecInput extends ImageCreateSpecIdInput {
  spec: ImageCreateGenerationSpec;
}

interface ResolvedImageCreateReferenceImage extends AssetFile {
  assetId: string;
  assetFileId: string;
  role: string;
}

interface ResolvedImageCreateReferenceFile {
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image';
  role: string;
  label?: string;
}

export async function buildImageCreateContext(
  input: ImageCreateTargetInput
): Promise<ImageCreateGenerationContext> {
  const agentMedia = await buildImageCreateAgentMediaReport(input);
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const project = requireImageCreateProject(session, input.projectId);
    return {
      purpose: IMAGE_CREATE_GENERATION_PURPOSE,
      target: { kind: 'project', id: project.id },
      project: {
        id: project.id,
        name: project.name,
        title: project.title,
        aspectRatio: project.aspectRatio ?? null,
      },
      recommendedModelChoice: 'fal-ai/openai/gpt-image-2',
      modelDefaults: {
        textToImage: defaultParameterValues('fal-ai/openai/gpt-image-2'),
        referenceToImage: defaultParameterValues('fal-ai/openai/gpt-image-2'),
      },
      agentMedia,
    };
  });
}

export async function listImageCreateModels(
  input: ImageCreateTargetInput
): Promise<ImageCreateModelListReport> {
  const context = await buildImageCreateContext(input);
  return {
    purpose: IMAGE_CREATE_GENERATION_PURPOSE,
    target: context.target,
    models: imageCreateModelChoices(),
  };
}

export async function validateImageCreateSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageCreateGenerationSpec;
}): Promise<{
  valid: true;
  spec: ImageCreateGenerationSpec;
  providerPayload: Record<string, unknown>;
}> {
  const normalized = await normalizeSpec(input);
  const plan = await prepareImageCreateProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createImageCreateSpec(
  input: ImageCreateSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateImageCreateSpec({
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

export async function updateImageCreateSpec(
  input: UpdateImageCreateSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateImageCreateSpec({
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

export async function listImageCreateSpecs(
  input: ImageCreateTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildImageCreateContext(input);
  return withMediaGenerationProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: IMAGE_CREATE_GENERATION_PURPOSE,
      targetKind: 'project',
      targetId: context.target.id,
    }),
  }));
}

export async function prepareImageCreateSpec(
  input: ImageCreateSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readImageCreateSpec(input);
  assertImageCreateSpec(specRecord.spec);
  const plan = await prepareImageCreateProviderPlan({
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

export async function prepareImageCreateDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageCreateGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const plan = await prepareImageCreateProviderPlan({
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

export async function buildImageCreateGenerationPreview(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}) {
  const { specRecord } = input;
  assertImageCreateSpec(specRecord.spec);
  const plan = await prepareImageCreateProviderPlan({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: specRecord.spec,
  });
  const project = await readImageCreateProject(input);
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: IMAGE_CREATE_GENERATION_PURPOSE,
    project,
    target: specRecord.target,
    title: specRecord.title,
    modelChoice: specRecord.spec.modelChoice,
    modelLabel:
      imageCreateModelChoices().find(
        (model) => model.modelChoice === specRecord.spec.modelChoice
      )?.label ?? specRecord.spec.modelChoice,
    provider: plan.provider,
    providerModel: plan.model,
    mode: plan.mode,
    authoredPrompt: specRecord.spec.prompt,
    references: imageCreatePreviewReferences(plan.referenceImages),
    providerTokenOrder: plan.referenceImages
      .map((reference) => reference.assetFileId)
      .concat(
        (specRecord.spec.referenceFiles ?? []).map(
          (referenceFile) => referenceFile.projectRelativePath
        )
      ),
    payload: plan.payload,
  });
}

export async function runImageCreateSpec(
  input: ImageCreateSpecIdInput & {
    simulate?: boolean;
    approveLiveProviderRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<MediaGenerationRunReport> {
  throw new ProjectDataError(
    'CORE_IMAGE_CREATE_RUN_USE_SHARED_LIFECYCLE',
    `Image create runs use the shared media generation lifecycle: ${input.specId}.`
  );
}

async function readImageCreateSpec(
  input: ImageCreateSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withMediaGenerationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageCreateGenerationSpec;
}): Promise<ImageCreateGenerationSpec> {
  if (input.spec.purpose !== IMAGE_CREATE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PURPOSE_UNSUPPORTED',
      `Unsupported image create generation purpose: ${input.spec.purpose}.`
    );
  }
  if (input.spec.target?.kind !== 'project' || !input.spec.target.id) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PROJECT_TARGET_MISSING',
      'Image create generation requires a project target.'
    );
  }
  if (!isImageCreateMode(input.spec.mode)) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_MODE_UNSUPPORTED',
      `Unsupported image create mode: ${String(input.spec.mode)}.`
    );
  }
  if (!IMAGE_CREATE_MODELS.has(input.spec.modelChoice)) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_MODEL_UNSUPPORTED',
      `Unsupported image create model choice: ${input.spec.modelChoice}.`
    );
  }
  const prompt = input.spec.prompt?.trim() ?? '';
  if (!prompt) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PROMPT_REQUIRED',
      'Image create generation requires a non-empty prompt.'
    );
  }
  const referenceImages = normalizeReferenceImages(input.spec.referenceImages ?? []);
  const referenceFiles = normalizeReferenceFiles(input.spec.referenceFiles ?? []);
  validateReferenceInputs({
    mode: input.spec.mode,
    modelChoice: input.spec.modelChoice,
    count: referenceImages.length + referenceFiles.length,
  });
  const parameterValues = normalizeParameterValues(
    input.spec.modelChoice,
    input.spec.parameterValues ?? {}
  );
  await withMediaGenerationProjectSession(input, async ({ session, projectFolder }) => {
    requireImageCreateProject(session, input.spec.target.id);
    resolveReferenceImages(session, referenceImages);
    await validateReferenceFiles(projectFolder, referenceFiles);
  });
  return {
    purpose: IMAGE_CREATE_GENERATION_PURPOSE,
    target: { kind: 'project', id: input.spec.target.id },
    mode: input.spec.mode,
    modelChoice: input.spec.modelChoice,
    prompt,
    referenceImages,
    ...(referenceFiles.length > 0 ? { referenceFiles } : {}),
    parameterValues,
    ...(input.spec.title?.trim() ? { title: input.spec.title.trim() } : {}),
  };
}

async function prepareImageCreateProviderPlan(input: {
  projectName?: string;
  homeDir?: string;
  spec: ImageCreateGenerationSpec;
}): Promise<ImageCreateProviderPlan> {
  return withMediaGenerationProjectSession(input, async ({ session, projectFolder }) => {
    requireImageCreateProject(session, input.spec.target.id);
    const references = resolveReferenceImages(session, input.spec.referenceImages);
    const referenceFiles = resolveReferenceFiles(input.spec.referenceFiles ?? []);
    await validateReferenceFiles(projectFolder, referenceFiles);
    return buildProviderPayload(input.spec, references, referenceFiles);
  });
}

function requireImageCreateProject(
  session: DatabaseSession,
  projectId?: string
) {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PROJECT_MISSING',
      'Image create generation requires an active project.'
    );
  }
  if (projectId && project.id !== projectId) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PROJECT_TARGET_MISMATCH',
      `Image create target project does not match the current project: ${projectId}.`
    );
  }
  return project;
}

function normalizeReferenceImages(
  references: ImageCreateReferenceImage[]
): ImageCreateReferenceImage[] {
  return references.map((reference) => {
    const role = reference.role?.trim() ?? '';
    if (!reference.assetId || !reference.assetFileId || !role) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_INVALID',
        'Image create reference images require assetId, assetFileId, and role.'
      );
    }
    return {
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
      role,
    };
  });
}

function normalizeReferenceFiles(
  references: GenerationReferenceFileInput[]
): ResolvedImageCreateReferenceFile[] {
  if (!Array.isArray(references)) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_REFERENCE_FILE_INVALID',
      'Image create referenceFiles must be an array.'
    );
  }
  return references.map((referenceFile, index) => {
    if (!referenceFile || typeof referenceFile !== 'object' || Array.isArray(referenceFile)) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_INVALID',
        `Image create referenceFiles[${index}] must be an object.`
      );
    }
    const candidate = referenceFile as {
      projectRelativePath?: unknown;
      mediaKind?: unknown;
      role?: unknown;
      label?: unknown;
    };
    if (candidate.mediaKind !== 'image') {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_UNSUPPORTED',
        `Image create referenceFiles[${index}] must use mediaKind "image". Received: ${String(candidate.mediaKind)}.`
      );
    }
    const role = typeof candidate.role === 'string' ? candidate.role.trim() : '';
    if (!role) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_INVALID',
        `Image create referenceFiles[${index}].role must be a non-empty string.`
      );
    }
    if (typeof candidate.projectRelativePath !== 'string') {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_INVALID',
        `Image create referenceFiles[${index}].projectRelativePath must be a string.`
      );
    }
    if (
      candidate.label !== undefined &&
      typeof candidate.label !== 'string'
    ) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_INVALID',
        `Image create referenceFiles[${index}].label must be a string when provided.`
      );
    }
    const label =
      typeof candidate.label === 'string' ? candidate.label.trim() : undefined;
    return {
      projectRelativePath: normalizeProjectRelativePath(candidate.projectRelativePath),
      mediaKind: 'image',
      role,
      ...(label ? { label } : {}),
    };
  });
}

function validateReferenceInputs(input: {
  mode: ImageCreateMode;
  modelChoice: ImageCreateModelChoice;
  count: number;
}): void {
  if (input.mode === 'text-to-image' && input.count > 0) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_REFERENCES_UNSUPPORTED',
      'Image create text-to-image specs must not include referenceImages or referenceFiles.'
    );
  }
  if (input.mode === 'reference-to-image' && input.count === 0) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_REFERENCES_REQUIRED',
      'Image create reference-to-image specs require at least one reference image or reference file.'
    );
  }
  validateReferenceImageCount({
    mode: input.mode,
    modelChoice: input.modelChoice,
    count: input.count,
  });
}

function resolveReferenceImages(
  session: DatabaseSession,
  references: ImageCreateReferenceImage[]
): ResolvedImageCreateReferenceImage[] {
  return references.map((reference) => {
    const asset = readAssetRecord(session, reference.assetId);
    if (!asset || asset.discardedAt) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_ASSET_MISSING',
        `Image create reference asset was not found: ${reference.assetId}.`
      );
    }
    const file = readAssetFileRecord(session, {
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
    });
    if (!file) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_MISSING',
        `Image create reference file was not found: ${reference.assetFileId}.`
      );
    }
    if (file.mediaKind !== 'image') {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_NOT_IMAGE',
        `Image create reference file must be an image: ${reference.assetFileId}.`
      );
    }
    return {
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
      role: reference.role,
      id: file.id,
      projectRelativePath: normalizeProjectRelativePath(file.projectRelativePath),
      mediaKind: 'image',
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      contentHash: file.contentHash,
      width: file.width,
      height: file.height,
      durationSeconds: file.durationSeconds,
    };
  });
}

function resolveReferenceFiles(
  references: GenerationReferenceFileInput[]
): ResolvedImageCreateReferenceFile[] {
  return normalizeReferenceFiles(references);
}

async function validateReferenceFiles(
  projectFolder: string,
  referenceFiles: ResolvedImageCreateReferenceFile[]
): Promise<void> {
  for (const referenceFile of referenceFiles) {
    const absolutePath = resolveProjectRelativePath(
      projectFolder,
      referenceFile.projectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    await statExistingReferenceFile(absolutePath, referenceFile.projectRelativePath);
  }
}

async function statExistingReferenceFile(
  absolutePath: string,
  projectRelativePath: ProjectRelativePath
): Promise<void> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_REFERENCE_FILE_NOT_FILE',
        `Image create reference file must be a file: ${projectRelativePath}.`
      );
    }
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_REFERENCE_FILE_MISSING',
      `Image create reference file was not found: ${projectRelativePath}.`
    );
  }
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  resolvedPath: string
): void {
  const relativePath = path.relative(projectFolder, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_REFERENCE_FILE_OUTSIDE_PROJECT',
      `Image create reference file must stay inside the project folder: ${resolvedPath}.`
    );
  }
}

function buildProviderPayload(
  spec: ImageCreateGenerationSpec,
  references: ResolvedImageCreateReferenceImage[],
  referenceFiles: ResolvedImageCreateReferenceFile[]
): ImageCreateProviderPlan {
  validateReferenceImageCount({
    mode: spec.mode,
    modelChoice: spec.modelChoice,
    count: references.length + referenceFiles.length,
  });
  const outputCount = outputCountFromParameters(spec.parameterValues);
  const basePayload = {
    prompt: spec.prompt,
    sync_mode: false,
  };
  const referencePaths = [
    ...references.map((reference) => reference.projectRelativePath),
    ...referenceFiles.map((reference) => reference.projectRelativePath),
  ];
  const referencePayload =
    spec.mode === 'reference-to-image'
      ? {
          image_urls: referencePaths.map(logicalInputUrl),
        }
      : {};
  const inputFiles =
    spec.mode === 'reference-to-image'
      ? referencePaths.map((projectRelativePath) => ({
          field: 'image_urls',
          projectRelativePath,
          mediaKind: 'image' as const,
          asArray: true,
          required: true,
        }))
      : undefined;
  const payload = {
    ...basePayload,
    ...referencePayload,
    ...modelFixedParameters(spec.modelChoice, spec.mode),
    ...spec.parameterValues,
    num_images: outputCount,
  };
  return {
    provider: 'fal-ai',
    model: providerModel(spec.modelChoice, spec.mode),
    mode: spec.mode,
    payload,
    ...(inputFiles ? { inputFiles } : {}),
    referenceImages: references,
    referenceFileCount: referenceFiles.length,
    outputCount,
  };
}

function toGenerationRequest(
  plan: ImageCreateProviderPlan,
  spec: ImageCreateGenerationSpec
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
      ...(plan.inputFiles ? { inputFiles: plan.inputFiles } : {}),
      pricingInputCounts:
        spec.mode === 'reference-to-image'
          ? { image: plan.referenceImages.length + plan.referenceFileCount }
          : {},
      parameters,
      outputNames: outputNames(spec, plan.outputCount),
    },
  };
}

function providerModel(
  modelChoice: ImageCreateModelChoice,
  mode: ImageCreateMode
): ImageCreateProviderPlan['model'] {
  switch (modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return mode === 'reference-to-image'
        ? 'openai/gpt-image-2/edit'
        : 'openai/gpt-image-2';
    case 'fal-ai/nano-banana-2':
      return mode === 'reference-to-image'
        ? 'nano-banana-2/edit'
        : 'nano-banana-2';
    case 'fal-ai/xai/grok-imagine-image':
      return mode === 'reference-to-image'
        ? 'xai/grok-imagine-image/edit'
        : 'xai/grok-imagine-image';
    default:
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_MODEL_UNSUPPORTED',
        `Unsupported image create model choice: ${modelChoice}.`
      );
  }
}

function modelFixedParameters(
  modelChoice: ImageCreateModelChoice,
  mode: ImageCreateMode
): Record<string, unknown> {
  if (modelChoice === 'fal-ai/nano-banana-2') {
    return {
      ...(mode === 'reference-to-image' ? { safety_tolerance: '4' } : {}),
      limit_generations: true,
      enable_web_search: false,
    };
  }
  return {};
}

function logicalInputUrl(projectRelativePath: ProjectRelativePath): string {
  return `renku-input://${encodeURI(projectRelativePath)}`;
}

function normalizeParameterValues(
  modelChoice: ImageCreateModelChoice,
  parameterValues: Record<string, unknown>
): Record<string, unknown> {
  const allowed = allowedParameterKeys(modelChoice);
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameterValues)) {
    if (!allowed.has(key)) {
      throw new ProjectDataError(
        'CORE_IMAGE_CREATE_PARAMETERS_UNSUPPORTED',
        `Image create model ${modelChoice} does not support parameter "${key}".`
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
  modelChoice: ImageCreateModelChoice,
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

function allowedParameterKeys(modelChoice: ImageCreateModelChoice): Set<string> {
  switch (modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return new Set(['image_size', 'quality', 'output_format', 'num_images']);
    case 'fal-ai/nano-banana-2':
      return new Set([
        'aspect_ratio',
        'resolution',
        'output_format',
        'seed',
        'num_images',
      ]);
    case 'fal-ai/xai/grok-imagine-image':
      return new Set(['output_format', 'num_images']);
    default:
      return new Set();
  }
}

function unsupportedParameter(
  modelChoice: ImageCreateModelChoice,
  key: string,
  reason: string
): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_CREATE_PARAMETERS_UNSUPPORTED',
    `Image create parameter "${key}" for ${modelChoice} ${reason}.`
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

function outputNames(
  spec: ImageCreateGenerationSpec,
  outputCount: number
): string[] {
  const format = String(spec.parameterValues.output_format ?? 'png');
  const extension = format === 'jpeg' ? 'jpg' : format;
  return Array.from({ length: outputCount }, (_value, index) =>
    outputCount === 1
      ? `image-create-${spec.target.id}.${extension}`
      : `image-create-${spec.target.id}-${index + 1}.${extension}`
  );
}

function imageCreatePreviewReferences(
  references: ResolvedImageCreateReferenceImage[]
): GenerationPreviewRequestReference[] {
  return references.map((reference) => ({
    kind: 'image',
    role: reference.role,
    label: reference.role,
    providerToken: 'image_urls',
    assetId: reference.assetId,
    assetFileId: reference.assetFileId,
    selected: true,
  }));
}

function imageCreateModelChoices(): ImageCreateModelChoiceReport[] {
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: true,
      provider: 'fal-ai',
      textToImageModel: 'openai/gpt-image-2',
      referenceToImageModel: 'openai/gpt-image-2/edit',
      mediaKind: 'image',
      modes: ['text-to-image', 'reference-to-image'],
      referenceImageCount: {
        min: 1,
        max: referenceImageMaxCount('fal-ai/openai/gpt-image-2'),
      },
      defaultParameterValues: {
        textToImage: defaultParameterValues('fal-ai/openai/gpt-image-2'),
        referenceToImage: defaultParameterValues('fal-ai/openai/gpt-image-2'),
      },
      parameterRows: {
        textToImage: parameterRows('fal-ai/openai/gpt-image-2'),
        referenceToImage: parameterRows('fal-ai/openai/gpt-image-2'),
      },
    },
    {
      modelChoice: 'fal-ai/nano-banana-2',
      label: 'Nano Banana 2',
      available: true,
      provider: 'fal-ai',
      textToImageModel: 'nano-banana-2',
      referenceToImageModel: 'nano-banana-2/edit',
      mediaKind: 'image',
      modes: ['text-to-image', 'reference-to-image'],
      referenceImageCount: {
        min: 1,
        max: referenceImageMaxCount('fal-ai/nano-banana-2'),
      },
      defaultParameterValues: {
        textToImage: defaultParameterValues('fal-ai/nano-banana-2'),
        referenceToImage: defaultParameterValues('fal-ai/nano-banana-2'),
      },
      parameterRows: {
        textToImage: parameterRows('fal-ai/nano-banana-2'),
        referenceToImage: parameterRows('fal-ai/nano-banana-2'),
      },
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      label: 'Grok Imagine Image',
      available: true,
      provider: 'fal-ai',
      textToImageModel: 'xai/grok-imagine-image',
      referenceToImageModel: 'xai/grok-imagine-image/edit',
      mediaKind: 'image',
      modes: ['text-to-image', 'reference-to-image'],
      referenceImageCount: {
        min: 1,
        max: referenceImageMaxCount('fal-ai/xai/grok-imagine-image'),
      },
      defaultParameterValues: {
        textToImage: defaultParameterValues('fal-ai/xai/grok-imagine-image'),
        referenceToImage: defaultParameterValues('fal-ai/xai/grok-imagine-image'),
      },
      parameterRows: {
        textToImage: parameterRows('fal-ai/xai/grok-imagine-image'),
        referenceToImage: parameterRows('fal-ai/xai/grok-imagine-image'),
      },
    },
  ];
}

function validateReferenceImageCount(input: {
  mode: ImageCreateMode;
  modelChoice: ImageCreateModelChoice;
  count: number;
}): void {
  if (input.mode !== 'reference-to-image') {
    return;
  }
  const max = referenceImageMaxCount(input.modelChoice);
  if (input.count > max) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_REFERENCE_COUNT_UNSUPPORTED',
      `Image create model ${input.modelChoice} supports at most ${max} reference images.`
    );
  }
}

function referenceImageMaxCount(
  modelChoice: ImageCreateModelChoice
): number {
  return IMAGE_CREATE_REFERENCE_IMAGE_MAX_COUNTS[modelChoice];
}

function defaultParameterValues(
  modelChoice: ImageCreateModelChoice
): Record<string, unknown> {
  switch (modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return {
        image_size: { width: 1024, height: 768 },
        quality: 'high',
        output_format: 'png',
        num_images: 1,
      };
    case 'fal-ai/nano-banana-2':
      return {
        aspect_ratio: '4:3',
        resolution: '1K',
        output_format: 'png',
        seed: null,
        num_images: 1,
      };
    case 'fal-ai/xai/grok-imagine-image':
      return {
        output_format: 'png',
        num_images: 1,
      };
    default:
      return {};
  }
}

function parameterRows(
  modelChoice: ImageCreateModelChoice
): ImageCreateModelChoiceReport['parameterRows']['textToImage'] {
  switch (modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return [
        { key: 'image_size', label: 'Image size', required: false },
        { key: 'quality', label: 'Quality', required: false, allowedValues: [...GPT_QUALITIES] },
        { key: 'output_format', label: 'Output format', required: false, allowedValues: [...OUTPUT_FORMATS] },
        { key: 'num_images', label: 'Images', required: false, minimum: 1, maximum: 4 },
      ];
    case 'fal-ai/nano-banana-2':
      return [
        { key: 'aspect_ratio', label: 'Aspect ratio', required: false, allowedValues: [...NANO_ASPECT_RATIOS] },
        { key: 'resolution', label: 'Resolution', required: false, allowedValues: [...NANO_RESOLUTIONS] },
        { key: 'output_format', label: 'Output format', required: false, allowedValues: [...OUTPUT_FORMATS] },
        { key: 'seed', label: 'Seed', required: false, minimum: 0 },
        { key: 'num_images', label: 'Images', required: false, minimum: 1, maximum: 4 },
      ];
    case 'fal-ai/xai/grok-imagine-image':
      return [
        { key: 'output_format', label: 'Output format', required: false, allowedValues: [...OUTPUT_FORMATS] },
        { key: 'num_images', label: 'Images', required: false, minimum: 1, maximum: 4 },
      ];
    default:
      return [];
  }
}

async function readImageCreateProject(input: ImageCreateProjectInput) {
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const project = requireImageCreateProject(session);
    return {
      id: project.id,
      name: project.name,
      title: project.title,
    };
  });
}

async function buildImageCreateAgentMediaReport(input: ImageCreateProjectInput) {
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

function titleForSpec(spec: ImageCreateGenerationSpec): string {
  return spec.title?.trim() || 'Image create';
}

function isImageCreateMode(value: unknown): value is ImageCreateMode {
  return value === 'text-to-image' || value === 'reference-to-image';
}

function assertImageCreateSpec(
  spec: unknown
): asserts spec is ImageCreateGenerationSpec {
  if (
    !spec ||
    typeof spec !== 'object' ||
    (spec as ImageCreateGenerationSpec).purpose !== IMAGE_CREATE_GENERATION_PURPOSE
  ) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PURPOSE_UNSUPPORTED',
      'Media generation spec is not an image.create spec.'
    );
  }
}
