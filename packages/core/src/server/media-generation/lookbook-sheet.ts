import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  LookbookSheetDetail,
  LookbookSheetFrame,
  LookbookSheetGenerationContext,
  LookbookSheetGenerationSpec,
  LookbookSheetMediaImportReport,
  LookbookSheetModelChoice,
  LookbookSheetModelChoiceReport,
  LookbookSheetModelListReport,
  LookbookSheetOutputFormat,
  MediaGenerationEstimateReport,
  PreparedMediaGeneration,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
} from '../../client/index.js';
import { LOOKBOOK_SHEET_GENERATION_PURPOSE } from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../database/access/media-generation.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import {
  insertLookbookSheetRecord,
  nextLookbookSheetSortOrder,
  readLookbookSheet,
} from '../database/access/lookbook-sheets.js';
import { requireLookbookRecordById } from '../database/access/lookbook.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { readLookbookResource } from '../resources/lookbook.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import {
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../studio-coordination/resource-keys.js';
import { draftMediaGenerationSpecRecord } from './draft-generation.js';
import {
  allocateProjectRelativeFilePath,
  assertResolvedPathInsideProject,
  LOOKBOOK_ROOT,
} from '../visual-language-paths.js';

const PROJECT_ASPECT_RATIOS = new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9']);
const OUTPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);
const LOOKBOOK_SHEET_MODEL_CHOICES = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
  'fal-ai/bytedance/seedream/v5/lite/text-to-image',
]);

export interface LookbookSheetProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface LookbookSheetTargetInput extends LookbookSheetProjectInput {
  lookbookId: string;
}

export interface LookbookSheetSpecFileInput extends LookbookSheetProjectInput {
  spec: LookbookSheetGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface LookbookSheetSpecIdInput extends LookbookSheetProjectInput {
  specId: string;
}

export interface UpdateLookbookSheetSpecInput extends LookbookSheetSpecIdInput {
  spec: LookbookSheetGenerationSpec;
}

export interface RecordLookbookSheetRunInput extends LookbookSheetSpecIdInput {
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

export interface RunLookbookSheetSpecInput extends LookbookSheetSpecIdInput {
  approvalToken?: string;
  simulate?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ImportLookbookSheetMediaInput extends LookbookSheetTargetInput {
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

interface ProviderPlan {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  payload: Record<string, unknown>;
  outputCount: number;
}

export async function buildLookbookSheetContext(
  input: LookbookSheetTargetInput
): Promise<LookbookSheetGenerationContext> {
  const resource = await readLookbookResource({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: input.lookbookId,
  });
  const projectInformation = await readProjectInformationForInput(input);
  return {
    purpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
    target: {
      kind: 'lookbook',
      id: input.lookbookId,
    },
    project: {
      id: resource.project.id,
      name: resource.project.name,
      title: projectInformation.title,
      aspectRatio: projectInformation.aspectRatio ?? '16:9',
    },
    lookbook: resource.lookbook,
    sourceInspirationFolders: resource.sourceInspirationFolders,
    existingSheets: resource.sheets,
    cardImage: resource.cardImage,
    defaults: {
      takeCount: 1,
      seed: null,
      sheetFrame: 'project',
      resolvedAspectRatio: projectInformation.aspectRatio ?? '16:9',
      detail: 'standard',
      outputFormat: 'png',
    },
    resourceKeys: resource.resourceKeys,
  };
}

export async function listLookbookSheetModels(
  input: LookbookSheetTargetInput
): Promise<LookbookSheetModelListReport> {
  const context = await buildLookbookSheetContext(input);
  return {
    purpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
    target: context.target,
    models: modelChoices(context),
  };
}

export async function validateLookbookSheetSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LookbookSheetGenerationSpec;
}): Promise<{ valid: true; spec: LookbookSheetGenerationSpec; providerPayload: Record<string, unknown> }> {
  const normalized = normalizeSpec(input.spec);
  const context = await buildLookbookSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: normalized.target.id,
  });
  const plan = buildLookbookSheetProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createLookbookSheetSpec(
  input: LookbookSheetSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeSpec(input.spec);
  await validateLookbookSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized),
      now: new Date().toISOString(),
    });
  });
}

export async function updateLookbookSheetSpec(
  input: UpdateLookbookSheetSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeSpec(input.spec);
  await validateLookbookSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized),
      now: new Date().toISOString(),
    })
  );
}

export async function readLookbookSheetSpec(
  input: LookbookSheetSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listLookbookSheetSpecs(
  input: LookbookSheetTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
      targetKind: 'lookbook',
      targetId: input.lookbookId,
    }),
  }));
}

export async function prepareLookbookSheetSpec(
  input: LookbookSheetSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readLookbookSheetSpec(input);
  assertLookbookSheetSpec(specRecord.spec);
  const context = await buildLookbookSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: specRecord.spec.target.id,
  });
  const plan = buildLookbookSheetProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function prepareLookbookSheetDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LookbookSheetGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = normalizeSpec(input.spec);
  const context = await buildLookbookSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: normalized.target.id,
  });
  const plan = buildLookbookSheetProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

export async function estimateLookbookSheetSpec(
  input: LookbookSheetSpecIdInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareLookbookSheetSpec(input);
  const { estimateGeneration } = await loadGenerationEngines();
  const estimate = await estimateGeneration(prepared.generation);
  if (estimate.estimatedCostUsd === null) {
    throw new ProjectDataError(
      'PROJECT_DATA273',
      'Generation estimate is unknown for the selected Lookbook sheet model.'
    );
  }
  return { ...prepared, estimate };
}

export async function runLookbookSheetSpec(
  input: RunLookbookSheetSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareLookbookSheetSpec(input);
  const { estimateGeneration, runGeneration } = await loadGenerationEngines();
  const estimate = await estimateGeneration(prepared.generation);
  if (estimate.estimatedCostUsd === null) {
    throw new ProjectDataError(
      'PROJECT_DATA273',
      'Generation estimate is unknown for the selected Lookbook sheet model.'
    );
  }
  const outputPaths = await resolveLookbookSheetGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
  });
  return recordLookbookSheetRun({
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

export async function recordLookbookSheetRun(
  input: RecordLookbookSheetRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readLookbookSheetSpec(input);
  assertLookbookSheetSpec(specRecord.spec);
  const now = new Date().toISOString();
  const run = await withProjectSession(input, ({ session }) => {
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

async function loadGenerationEngines() {
  return import('@gorenku/studio-engines');
}

export async function importLookbookSheetMedia(
  input: ImportLookbookSheetMediaInput
): Promise<LookbookSheetMediaImportReport> {
  return withProjectSession(input, async ({ session, projectFolder, project }) => {
    requireLookbookRecordById(session, input.lookbookId);
    const now = new Date().toISOString();
    const imported = await importLookbookSheetFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title,
      oneLineSummary: input.oneLineSummary,
      idGenerator: input.idGenerator,
      now,
      origin: input.receipt ? 'generated' : 'imported',
    });
    const sheetId = imported.nextId('lookbook_sheet');
    insertLookbookSheetRecord(session, {
      id: sheetId,
      lookbookId: input.lookbookId,
      assetId: imported.assetId,
      sortOrder: nextLookbookSheetSortOrder(session, input.lookbookId),
      now,
    });
    const sheet = readLookbookSheet(session, sheetId);
    if (!sheet) {
      throw new ProjectDataError(
        'PROJECT_DATA244',
        `Lookbook sheet was not imported: ${sheetId}.`
      );
    }
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.sheetImported', lookbookId: input.lookbookId }],
      purpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
      target: { kind: 'lookbook', id: input.lookbookId },
      imported: sheet,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: [
        studioVisualLanguageLookbooksResourceKey(),
        studioVisualLanguageLookbookResourceKey(input.lookbookId),
      ],
    };
  });
}

function modelChoices(
  context: LookbookSheetGenerationContext
): LookbookSheetModelChoiceReport[] {
  const aspectRatio = context.project.aspectRatio;
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: aspectRatio !== '21:9',
      ...(aspectRatio === '21:9'
        ? {
            unavailableReason:
              'GPT Image 2 is not available for 21:9 Lookbook sheets because this slice only uses priced preset image sizes.',
          }
        : {}),
      supportsSeed: false,
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
        ? {
            unavailableReason:
              'Grok Imagine is not available for 21:9 Lookbook sheets because the schema does not expose exact 21:9.',
          }
        : {}),
      supportsSeed: false,
      takeCount: { min: 1, max: 4, default: 1 },
      supportedFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16'],
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
      label: 'Seedream v5 Lite',
      available: aspectRatio !== '21:9',
      ...(aspectRatio === '21:9'
        ? {
            unavailableReason:
              'Seedream v5 Lite is not available for 21:9 Lookbook sheets until explicit tested dimensions are added.',
          }
        : {}),
      supportsSeed: true,
      takeCount: { min: 1, max: 6, default: 1 },
      supportedFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16'],
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png'],
    },
  ];
}

function normalizeSpec(
  spec: LookbookSheetGenerationSpec
): LookbookSheetGenerationSpec {
  if (spec.purpose !== LOOKBOOK_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Unsupported generation purpose: ${spec.purpose}.`
    );
  }
  if (spec.target.kind !== 'lookbook') {
    throw new ProjectDataError(
      'PROJECT_DATA264',
      `Lookbook sheet generation requires target.kind "lookbook". Received: ${spec.target.kind}.`
    );
  }
  assertLookbookSheetModelChoice(spec.modelChoice);
  const takeCount = spec.takeCount ?? 1;
  if (!Number.isInteger(takeCount) || takeCount < 1) {
    throw new ProjectDataError(
      'PROJECT_DATA265',
      'Lookbook sheet takeCount must be a positive integer.'
    );
  }
  const seed = spec.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new ProjectDataError(
      'PROJECT_DATA266',
      'Lookbook sheet seed must be a non-negative integer or null.'
    );
  }
  const sheetFrame = spec.sheetFrame ?? 'project';
  if (sheetFrame !== 'project' && !PROJECT_ASPECT_RATIOS.has(sheetFrame)) {
    throw new ProjectDataError(
      'PROJECT_DATA267',
      `Unsupported Lookbook sheet frame: ${sheetFrame}.`
    );
  }
  const detail = spec.detail ?? 'standard';
  if (detail !== 'draft' && detail !== 'standard' && detail !== 'high') {
    throw new ProjectDataError(
      'PROJECT_DATA268',
      `Unsupported Lookbook sheet detail: ${detail}.`
    );
  }
  const outputFormat = spec.outputFormat ?? 'png';
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    throw new ProjectDataError(
      'PROJECT_DATA269',
      `Unsupported Lookbook sheet output format: ${outputFormat}.`
    );
  }
  return {
    ...spec,
    takeCount,
    seed,
    sheetFrame,
    detail,
    outputFormat,
  };
}

export function buildLookbookSheetProviderPayload(
  spec: LookbookSheetGenerationSpec,
  context: LookbookSheetGenerationContext
): ProviderPlan {
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return buildGptImage2Payload(spec, context);
    case 'fal-ai/nano-banana-2':
      return buildNanoBanana2Payload(spec, context);
    case 'fal-ai/xai/grok-imagine-image':
      return buildGrokImaginePayload(spec, context);
    case 'fal-ai/bytedance/seedream/v5/lite/text-to-image':
      return buildSeedreamV5Payload(spec, context);
    default:
      return unsupportedLookbookSheetModel(spec.modelChoice);
  }
}

function buildGptImage2Payload(
  spec: LookbookSheetGenerationSpec,
  context: LookbookSheetGenerationContext
): ProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null) {
    unsupported('GPT Image 2 does not support generation seed.');
  }
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      image_size: mapPresetFrame(resolveFrame(spec, context), 'gpt-image-2'),
      quality: mapGptQuality(requireDetail(spec)),
      output_format: requireOutputFormat(spec),
      sync_mode: false,
    },
  };
}

function buildNanoBanana2Payload(
  spec: LookbookSheetGenerationSpec,
  context: LookbookSheetGenerationContext
): ProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      seed: spec.seed,
      aspect_ratio: resolveFrame(spec, context),
      resolution: mapNanoBananaResolution(requireDetail(spec)),
      output_format: requireOutputFormat(spec),
      safety_tolerance: '4',
      limit_generations: true,
      enable_web_search: false,
      sync_mode: false,
    },
  };
}

function buildGrokImaginePayload(
  spec: LookbookSheetGenerationSpec,
  context: LookbookSheetGenerationContext
): ProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null) {
    unsupported('Grok Imagine does not support generation seed.');
  }
  if (requireDetail(spec) !== 'standard') {
    unsupported('Grok Imagine supports only standard detail.');
  }
  const frame = resolveFrame(spec, context);
  if (frame === '21:9') {
    unsupported('Grok Imagine does not support exact 21:9.');
  }
  return {
    provider: 'fal-ai',
    model: 'xai/grok-imagine-image',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      aspect_ratio: frame,
      output_format: requireOutputFormat(spec),
      sync_mode: false,
    },
  };
}

function buildSeedreamV5Payload(
  spec: LookbookSheetGenerationSpec,
  context: LookbookSheetGenerationContext
): ProviderPlan {
  const takeCount = requireTakeCount(spec, 6);
  if (requireDetail(spec) !== 'standard') {
    unsupported('Seedream v5 Lite supports only standard detail in this slice.');
  }
  if (requireOutputFormat(spec) !== 'png') {
    unsupported('Seedream v5 Lite supports only png output in this slice.');
  }
  return {
    provider: 'fal-ai',
    model: 'bytedance/seedream/v5/lite/text-to-image',
    outputCount: takeCount,
    payload: {
      prompt: spec.prompt,
      num_images: takeCount,
      max_images: 1,
      seed: spec.seed,
      image_size: mapPresetFrame(resolveFrame(spec, context), 'seedream-v5-lite'),
      enhance_prompt_mode: 'standard',
      enable_safety_checker: true,
      sync_mode: false,
    },
  };
}

function resolveFrame(
  spec: LookbookSheetGenerationSpec,
  context: LookbookSheetGenerationContext
): Exclude<LookbookSheetFrame, 'project'> {
  const frame = spec.sheetFrame ?? 'project';
  if (frame !== 'project') {
    return frame;
  }
  const projectFrame = context.project.aspectRatio;
  if (!projectFrame || !PROJECT_ASPECT_RATIOS.has(projectFrame)) {
    throw new ProjectDataError(
      'PROJECT_DATA270',
      'Lookbook sheet frame is set to project, but the project has no supported aspect ratio.'
    );
  }
  return projectFrame as Exclude<LookbookSheetFrame, 'project'>;
}

function mapPresetFrame(
  frame: Exclude<LookbookSheetFrame, 'project'>,
  model: 'gpt-image-2' | 'seedream-v5-lite'
): string {
  if (frame === '1:1') {
    return 'square';
  }
  if (frame === '3:4') {
    return 'portrait_4_3';
  }
  if (frame === '4:3') {
    return 'landscape_4_3';
  }
  if (frame === '16:9') {
    return 'landscape_16_9';
  }
  if (frame === '9:16') {
    return 'portrait_16_9';
  }
  unsupported(
    `${model === 'gpt-image-2' ? 'GPT Image 2' : 'Seedream v5 Lite'} does not support 21:9 in this slice.`
  );
}

function mapGptQuality(detail: LookbookSheetDetail): 'low' | 'medium' | 'high' {
  if (detail === 'draft') {
    return 'low';
  }
  if (detail === 'standard') {
    return 'medium';
  }
  return 'high';
}

function mapNanoBananaResolution(detail: LookbookSheetDetail): '1K' | '2K' | '4K' {
  if (detail === 'draft') {
    return '1K';
  }
  if (detail === 'standard') {
    return '2K';
  }
  return '4K';
}

function toGenerationRequest(
  plan: ProviderPlan,
  spec: LookbookSheetGenerationSpec
): PreparedMediaGeneration['generation'] {
  const { prompt, ...parameters } = plan.payload;
  return {
    policy: {
      provider: plan.provider,
      model: plan.model,
      mediaKind: 'image',
      mode: 'text-to-image',
      outputCount: plan.outputCount,
    },
    request: {
      prompt: typeof prompt === 'string' ? prompt : spec.prompt,
      parameters,
      outputNames: outputNames(spec, plan.outputCount),
    },
  };
}

function requireTakeCount(spec: LookbookSheetGenerationSpec, max: number): number {
  const takeCount = spec.takeCount ?? 1;
  if (takeCount > max) {
    unsupported(`Selected model supports at most ${max} takes per run.`);
  }
  return takeCount;
}

function requireDetail(spec: LookbookSheetGenerationSpec): LookbookSheetDetail {
  return spec.detail ?? 'standard';
}

function requireOutputFormat(
  spec: LookbookSheetGenerationSpec
): LookbookSheetOutputFormat {
  return spec.outputFormat ?? 'png';
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}

function assertLookbookSheetModelChoice(
  modelChoice: string
): asserts modelChoice is LookbookSheetModelChoice {
  if (!LOOKBOOK_SHEET_MODEL_CHOICES.has(modelChoice)) {
    unsupportedLookbookSheetModel(modelChoice);
  }
}

function assertLookbookSheetSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is LookbookSheetGenerationSpec {
  if (spec.purpose !== LOOKBOOK_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
}

function unsupportedLookbookSheetModel(modelChoice: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA274',
    `Unsupported Lookbook sheet model: ${modelChoice}.`
  );
}

function titleForSpec(spec: LookbookSheetGenerationSpec): string {
  return spec.title?.trim() || spec.prompt.trim().slice(0, 80) || 'Lookbook sheet';
}

function outputNames(spec: LookbookSheetGenerationSpec, count: number): string[] {
  const base = slugify(titleForSpec(spec));
  const extension = extensionForOutputFormat(requireOutputFormat(spec));
  return Array.from({ length: count }, (_, index) =>
    count === 1
      ? `${base}${extension}`
      : `${base}-${String(index + 1).padStart(2, '0')}${extension}`
  );
}

function extensionForOutputFormat(format: LookbookSheetOutputFormat): string {
  return format === 'jpeg' ? '.jpg' : `.${format}`;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'lookbook-sheet';
}

async function readProjectInformationForInput(input: LookbookSheetProjectInput) {
  return withProjectSession(input, ({ session }) =>
    readProjectInformationResourceFromDatabase(session)
  );
}

export async function resolveLookbookSheetGenerationOutputPaths(input: LookbookSheetProjectInput) {
  return withProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
    };
  });
}

async function withProjectSession<T>(
  input: LookbookSheetProjectInput,
  fn: (handle: {
    projectFolder: string;
    project: Pick<ProjectRecord, 'id' | 'name'>;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({ ...handle, project: requireProjectRecord(handle.session) });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      projectFolder: currentProject.projectFolder,
      project: { id: currentProject.projectId, name: currentProject.projectName },
      session,
    })
  );
}

function requireProjectRecord(session: DatabaseSession): ProjectRecord {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}

function toProjectReport(
  project: Pick<ProjectRecord, 'id' | 'name'>,
  projectFolder: string
) {
  return {
    id: project.id,
    name: project.name,
    projectFolder,
  };
}

async function importLookbookSheetFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    input.sourceProjectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const stats = await statExistingFile(sourcePath);
  const contentHash = await hashFile(sourcePath);
  const destinationProjectRelativePath = await allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: LOOKBOOK_ROOT,
    fileName: path.basename(sourceProjectRelativePath),
  });
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }

  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const assetId = ids('asset');
  insertAssetRecord(input.session, {
    id: assetId,
    type: 'lookbook_sheet',
    mediaKind: 'image',
    title:
      input.title?.trim() ||
      path.parse(destinationProjectRelativePath).name,
    oneLineSummary: input.oneLineSummary?.trim() || undefined,
    origin: input.origin,
    availability: 'ready',
    createdAt: input.now,
    updatedAt: input.now,
  });
  insertAssetFileRecord(input.session, {
    id: ids('asset_file'),
    assetId,
    role: 'source',
    projectRelativePath: destinationProjectRelativePath,
    mediaKind: 'image',
    sizeBytes: stats.size,
    contentHash,
    createdAt: input.now,
    updatedAt: input.now,
  });

  return {
    assetId,
    nextId: ids,
  };
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA245',
      `Media import source file does not exist: ${absolutePath}.`
    );
  }
}

async function hashFile(absolutePath: string): Promise<string> {
  const buffer = await fs.readFile(absolutePath);
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}
