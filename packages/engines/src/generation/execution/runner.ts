import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createProviderRegistry } from '../../registry.js';
import {
  loadModelInputSchema,
  lookupModel,
  type LoadedModelCatalog,
} from '../../model-catalog.js';
import { createSimulatedFallbackArtifacts } from '../../simulated-fallback-output.js';
import type { ProviderJobContext, ProviderMode } from '../../types.js';
import {
  modelTypeToMediaKind,
  type GenerationOutput,
  type GenerationPolicy,
  type GenerationRequest,
  type GenerationRunResult,
} from '../contracts.js';
import {
  loadBundledGenerationCatalog,
  resolveBundledModelCatalogDir,
} from '../catalog/model-discovery.js';
import { buildLogicalProviderPayload } from './logical-provider-payload.js';
import {
  assignGenerationInputFilePayloadValue,
  createGenerationProviderPayloadBase,
} from './input-file-payload.js';
import { hashGenerationRequest } from './request-hash.js';
import { validateGenerationProviderPayload } from './provider-payload-validation.js';

export interface RunGenerationOptions {
  policy: GenerationPolicy;
  request: GenerationRequest;
  mode: ProviderMode;
  catalog?: LoadedModelCatalog;
  outputRoot?: string;
  outputProjectRelativeRoot?: string;
  inputRoot?: string;
}

export async function runGeneration(
  options: RunGenerationOptions
): Promise<GenerationRunResult> {
  const catalog = options.catalog ?? (await loadBundledGenerationCatalog());
  const model = lookupModel(
    catalog,
    options.policy.provider,
    options.policy.model
  );
  if (!model) {
    throw new Error(
      `Unknown generation model: ${options.policy.provider}/${options.policy.model}.`
    );
  }
  const mediaKind = modelTypeToMediaKind(model.type);
  if (mediaKind !== options.policy.mediaKind) {
    throw new Error(
      `Generation policy mediaKind ${options.policy.mediaKind} does not match model mediaKind ${mediaKind}.`
    );
  }

  const requestHash = hashGenerationRequest({
    policy: options.policy,
    request: options.request,
  });

  const catalogModelsDir = resolveBundledModelCatalogDir();
  const rawSchema = await loadModelInputSchema(
    catalogModelsDir,
    catalog,
    options.policy.provider,
    options.policy.model
  );
  const payload = buildLogicalProviderPayload(options.policy, options.request);
  await validateGenerationProviderPayload({
    catalog,
    provider: options.policy.provider,
    model: options.policy.model,
    payload,
  });
  const outputCount =
    options.policy.outputCount ?? deriveGenerationOutputCount(payload);
  const executionPayload = await buildExecutionProviderPayload({
    policy: options.policy,
    request: options.request,
    inputRoot: options.inputRoot,
  });
  const jobContext = createProviderJobContext({
    provider: options.policy.provider,
    model: options.policy.model,
    payload: executionPayload,
    rawSchema,
    mediaKind: options.policy.mediaKind,
    outputCount,
    expectedOutputMimeType: model.mime?.[0],
  });
  const result =
    options.mode === 'simulated'
      ? {
          artifacts: await createSimulatedFallbackArtifacts(jobContext),
          diagnostics: {
            provider: options.policy.provider,
            model: options.policy.model,
            simulated: true,
          },
        }
      : await runLiveGeneration({
          catalog,
          catalogModelsDir,
          policy: options.policy,
          jobContext,
        });
  const outputs = await persistOutputs({
    artifacts: result.artifacts,
    outputRoot: options.outputRoot,
    outputProjectRelativeRoot: options.outputProjectRelativeRoot,
    requestedNames: options.request.outputNames,
  });

  return {
    outputs,
    diagnostics: result.diagnostics,
    receipt: {
      provider: options.policy.provider,
      model: options.policy.model,
      mediaKind: options.policy.mediaKind,
      mode: options.policy.mode,
      generatedAt: new Date().toISOString(),
      requestHash,
      outputs,
      simulated: options.mode === 'simulated',
    },
  };
}

function createProviderJobContext(input: {
  provider: string;
  model: string;
  payload: Record<string, unknown>;
  rawSchema: string | null;
  mediaKind: string;
  outputCount: number;
  expectedOutputMimeType?: string;
}): ProviderJobContext {
  const inputBindings = Object.fromEntries(
    Object.keys(input.payload).map((key) => [key, `Input:${key}`])
  );
  const resolvedInputs = Object.fromEntries(
    Object.entries(input.payload).map(([key, value]) => [`Input:${key}`, value])
  );
  const sdkMapping = Object.fromEntries(
    Object.keys(input.payload).map((key) => [key, { input: key, field: key }])
  );
  return {
    jobId: `generation-${Date.now()}`,
    provider: input.provider,
    model: input.model,
    revision: 'media-generation',
    layerIndex: 0,
    attempt: 1,
    inputs: Object.keys(input.payload),
    produces: Array.from(
      { length: Math.max(1, input.outputCount) },
      (_, index) =>
        `Artifact:${artifactKindForMedia(input.mediaKind)}[output=${index + 1}]`
    ),
    context: {
      extras: {
        schema: input.rawSchema
          ? { raw: input.rawSchema, input: input.rawSchema }
          : undefined,
        resolvedInputs,
        jobContext: {
          inputBindings,
          sdkMapping,
        },
        expectedOutputMimeType: input.expectedOutputMimeType,
      },
    },
  };
}

async function buildExecutionProviderPayload(input: {
  policy: GenerationPolicy;
  request: GenerationRequest;
  inputRoot?: string;
}): Promise<Record<string, unknown>> {
  const payload = createGenerationProviderPayloadBase(
    input.policy,
    input.request
  );
  const files = input.request.inputFiles ?? [];
  if (files.length === 0) {
    return payload;
  }
  if (!input.inputRoot) {
    throw new Error(
      'Generation inputRoot is required when inputFiles are present.'
    );
  }
  for (const file of files) {
    const blob = await readGenerationInputFile(
      input.inputRoot,
      file.projectRelativePath
    );
    assignGenerationInputFilePayloadValue({ payload, file, value: blob });
  }
  return payload;
}

async function readGenerationInputFile(
  inputRoot: string,
  projectRelativePath: string
): Promise<{ data: Uint8Array; mimeType: string }> {
  const root = path.resolve(inputRoot);
  const absolutePath = path.resolve(root, projectRelativePath);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(
      `Generation input file must stay inside the project folder. Received: ${projectRelativePath}`
    );
  }
  const data = await fs.readFile(absolutePath);
  return {
    data,
    mimeType: mimeTypeForPath(projectRelativePath),
  };
}

function mimeTypeForPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

async function runLiveGeneration(input: {
  catalog: LoadedModelCatalog;
  catalogModelsDir: string;
  policy: GenerationPolicy;
  jobContext: ProviderJobContext;
}) {
  const registry = createProviderRegistry({
    mode: 'live',
    catalog: input.catalog,
    catalogModelsDir: input.catalogModelsDir,
  });
  const handler = registry.resolve({
    provider: input.policy.provider,
    model: input.policy.model,
    environment: 'cloud',
  });
  return handler.invoke(input.jobContext);
}

function artifactKindForMedia(mediaKind: string): string {
  if (mediaKind === 'image') {
    return 'GeneratedImage';
  }
  if (mediaKind === 'video') {
    return 'GeneratedVideo';
  }
  if (mediaKind === 'audio') {
    return 'GeneratedAudio';
  }
  return 'GeneratedJson';
}

function deriveGenerationOutputCount(payload: Record<string, unknown>): number {
  const raw = payload.num_images ?? payload.numImages ?? payload.count;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

async function persistOutputs(input: {
  artifacts: Array<{
    artifactId: string;
    blob?: { data: Uint8Array | string; mimeType: string };
    diagnostics?: Record<string, unknown>;
  }>;
  outputRoot?: string;
  outputProjectRelativeRoot?: string;
  requestedNames?: string[];
}): Promise<GenerationOutput[]> {
  const outputs: GenerationOutput[] = [];
  for (const [index, artifact] of input.artifacts.entries()) {
    const data = artifact.blob?.data;
    const bytes = typeof data === 'string' ? Buffer.from(data) : data;
    const contentHash = bytes
      ? `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`
      : undefined;
    const mimeType = artifact.blob?.mimeType;
    let projectRelativePath: string | undefined;
    if (bytes && input.outputRoot && input.outputProjectRelativeRoot) {
      const fileName = safeOutputFileName(
        input.requestedNames?.[index] ??
          `${artifact.artifactId}${extensionForMime(mimeType)}`
      );
      const root = path.resolve(input.outputRoot);
      const absolutePath = resolveOutputPath(root, fileName);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, bytes);
      projectRelativePath = path.posix.join(
        input.outputProjectRelativeRoot,
        fileName
      );
    }
    outputs.push({
      artifactId: artifact.artifactId,
      ...(mimeType ? { mimeType } : {}),
      ...(projectRelativePath ? { projectRelativePath } : {}),
      ...(contentHash ? { contentHash } : {}),
      ...(artifact.diagnostics ? { diagnostics: artifact.diagnostics } : {}),
    });
  }
  return outputs;
}

function safeOutputFileName(fileName: string): string {
  if (
    fileName.length === 0 ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('\0') ||
    path.isAbsolute(fileName) ||
    path.win32.isAbsolute(fileName)
  ) {
    throw new Error(
      `Generation outputNames entries must be file names inside the output directory. Received: ${fileName}`
    );
  }
  return fileName;
}

function resolveOutputPath(outputRoot: string, fileName: string): string {
  const absolutePath = path.resolve(outputRoot, fileName);
  const relativePath = path.relative(outputRoot, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(
      `Generation output path must stay inside the output directory. Received: ${fileName}`
    );
  }
  return absolutePath;
}

function extensionForMime(mimeType?: string): string {
  if (mimeType === 'image/jpeg') {
    return '.jpg';
  }
  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'video/mp4') {
    return '.mp4';
  }
  if (mimeType === 'audio/mpeg') {
    return '.mp3';
  }
  if (mimeType === 'audio/mp3') {
    return '.mp3';
  }
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
    return '.wav';
  }
  if (mimeType === 'application/json') {
    return '.json';
  }
  if (mimeType === 'text/plain') {
    return '.txt';
  }
  return '.bin';
}
