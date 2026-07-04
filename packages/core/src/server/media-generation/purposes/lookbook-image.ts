import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  LookbookImageDetail,
  LookbookImageFrame,
  LookbookImageGenerationContext,
  LookbookImageGenerationSpec,
  LookbookImageMediaImportReport,
  LookbookImageModelChoice,
  LookbookImageModelChoiceReport,
  LookbookImageModelListReport,
  LookbookImageOutputFormat,
  PreparedMediaGeneration,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import { LOOKBOOK_IMAGE_GENERATION_PURPOSE } from '../../../client/index.js';
import { insertAssetFileRecord } from '../../database/access/asset-files.js';
import { insertAssetRecord } from '../../database/access/assets.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import { readProjectInformationResourceFromDatabase } from '../../database/access/project-information.js';
import {
  insertLookbookImageRecord,
  nextLookbookImageSortOrder,
  readLookbookImage,
  setLookbookImageSectionRecords,
} from '../../database/access/lookbook-images.js';
import { requireLookbookRecordById } from '../../database/access/lookbook.js';
import {
  readProjectRecord,
  type ProjectRecord,
} from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
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
import { ProjectDataError } from '../../project-data-error.js';
import { readLookbookResource } from '../../resources/lookbook.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import {
  assertLookbookImagePlacementCapacity,
  replaceSingleLookbookImagePlacementSlots,
} from '../../lookbook-image-placement-service.js';
import { resolveLookbookImagePlacements } from '../../visual-language-json/lookbook-image-placement.js';
import {
  studioVisualLanguageLookbookResourceKey,
  studioVisualLanguageLookbooksResourceKey,
} from '../../studio-coordination/resource-keys.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';
import { estimateMediaGenerationSpecRecordCost } from '../cost/cost-projection.js';
import {
  mediaGenerationEstimateWithApproval,
  mediaGenerationRunApprovalToken,
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from '../cost/cost-approval.js';
import {
  assertLookbookSectionsForType,
} from '../../visual-language-json/validator.js';
import {
  allocateProjectRelativeFilePath,
  assertResolvedPathInsideProject,
  LOOKBOOK_ROOT,
} from '../../visual-language-paths.js';

const PROJECT_ASPECT_RATIOS = new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9']);
const OUTPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);
const LOOKBOOK_IMAGE_MODEL_CHOICES = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
  'fal-ai/bytedance/seedream/v5/lite/text-to-image',
]);

export interface LookbookImageProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface LookbookImageTargetInput extends LookbookImageProjectInput {
  lookbookId: string;
}

export interface LookbookImageSpecFileInput extends LookbookImageProjectInput {
  spec: LookbookImageGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface LookbookImageSpecIdInput extends LookbookImageProjectInput {
  specId: string;
}

export interface UpdateLookbookImageSpecInput extends LookbookImageSpecIdInput {
  spec: LookbookImageGenerationSpec;
}

export interface RecordLookbookImageRunInput extends LookbookImageSpecIdInput {
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

export interface RunLookbookImageSpecInput extends LookbookImageSpecIdInput {
  approvalToken?: string;
  simulate?: boolean;
  approveUnpricedCost?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface ImportLookbookImageMediaInput extends LookbookImageTargetInput {
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  sections?: string[];
  anchorPointId?: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

interface ProviderPlan {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  payload: Record<string, unknown>;
  outputCount: number;
}

export async function buildLookbookImageContext(
  input: LookbookImageTargetInput
): Promise<LookbookImageGenerationContext> {
  const resource = await readLookbookResource({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: input.lookbookId,
  });
  const projectInformation = await readProjectInformationForInput(input);
  return {
    purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
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
    existingImages: resource.images,
    imagesBySection: resource.imagesBySection,
    cardImage: resource.cardImage,
    defaults: {
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      resolvedAspectRatio: projectInformation.aspectRatio ?? '16:9',
      detail: 'standard',
      outputFormat: 'png',
    },
    resourceKeys: resource.resourceKeys,
  };
}

export async function listLookbookImageModels(
  input: LookbookImageTargetInput
): Promise<LookbookImageModelListReport> {
  const context = await buildLookbookImageContext(input);
  return {
    purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
    target: context.target,
    models: modelChoices(context),
  };
}

export async function validateLookbookImageSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LookbookImageGenerationSpec;
}): Promise<{ valid: true; spec: LookbookImageGenerationSpec; providerPayload: Record<string, unknown> }> {
  const normalized = normalizeSpec(input.spec);
  const context = await buildLookbookImageContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: normalized.target.id,
  });
  const plan = buildLookbookImageProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createLookbookImageSpec(
  input: LookbookImageSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeSpec(input.spec);
  await validateLookbookImageSpec({
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

export async function updateLookbookImageSpec(
  input: UpdateLookbookImageSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeSpec(input.spec);
  await validateLookbookImageSpec({
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

export async function readLookbookImageSpec(
  input: LookbookImageSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listLookbookImageSpecs(
  input: LookbookImageTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
      targetKind: 'lookbook',
      targetId: input.lookbookId,
    }),
  }));
}

export async function prepareLookbookImageSpec(
  input: LookbookImageSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readLookbookImageSpec(input);
  assertLookbookImageSpec(specRecord.spec);
  const context = await buildLookbookImageContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: specRecord.spec.target.id,
  });
  const plan = buildLookbookImageProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function prepareLookbookImageDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LookbookImageGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = normalizeSpec(input.spec);
  const context = await buildLookbookImageContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: normalized.target.id,
  });
  const plan = buildLookbookImageProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

export async function runLookbookImageSpec(
  input: RunLookbookImageSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareLookbookImageSpec(input);
  const { runGeneration } = await loadGenerationEngines();
  const estimate = await estimateMediaGenerationSpecRecordCost(prepared.spec);
  const mode = input.simulate ? 'simulated' : 'live';
  const costApproval = requireMediaGenerationCostApproval({
    mode,
    purpose: prepared.spec.purpose,
    estimate,
    approval: parseMediaGenerationRunCostApproval({
      approvalToken: input.approvalToken,
      approveUnpricedCost: input.approveUnpricedCost,
    }),
  });
  const outputPaths = await resolveLookbookImageGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
  });
  return recordLookbookImageRun({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate: mediaGenerationEstimateWithApproval(estimate, costApproval),
    approvalToken: mediaGenerationRunApprovalToken(costApproval),
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: result.diagnostics ?? {},
    idGenerator: input.idGenerator,
  });
}

export async function recordLookbookImageRun(
  input: RecordLookbookImageRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readLookbookImageSpec(input);
  assertLookbookImageSpec(specRecord.spec);
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

export async function importLookbookImageMedia(
  input: ImportLookbookImageMediaInput
): Promise<LookbookImageMediaImportReport> {
  return withProjectSession(input, async ({ session, projectFolder, project }) => {
    const lookbook = requireLookbookRecordById(session, input.lookbookId);
    const now = new Date().toISOString();
    const placements = resolveLookbookImagePlacements({
      lookbook,
      sections: input.sections ?? [],
      anchorPointId: input.anchorPointId,
    });
    assertLookbookImagePlacementCapacity(session, {
      lookbookId: input.lookbookId,
      placements,
    });
    const imported = await importLookbookImageFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title,
      oneLineSummary: input.oneLineSummary,
      idGenerator: input.idGenerator,
      now,
      origin: input.receipt ? 'generated' : 'imported',
    });
    const imageId = imported.nextId('lookbook_image');
    insertLookbookImageRecord(session, {
      id: imageId,
      lookbookId: input.lookbookId,
      assetId: imported.assetId,
      sortOrder: nextLookbookImageSortOrder(session, input.lookbookId),
      now,
    });
    replaceSingleLookbookImagePlacementSlots(session, {
      lookbookId: input.lookbookId,
      imageId,
      placements,
      now,
    });
    setLookbookImageSectionRecords(session, {
      imageId,
      placements,
      nextId: () => imported.nextId('lookbook_image_section'),
      now,
    });
    const image = readLookbookImage(session, imageId);
    if (!image) {
      throw new ProjectDataError(
        'PROJECT_DATA244',
        `Lookbook image was not imported: ${imageId}.`
      );
    }
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'lookbook.imageImported', lookbookId: input.lookbookId }],
      purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
      target: { kind: 'lookbook', id: input.lookbookId },
      imported: image,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: [
        studioVisualLanguageLookbooksResourceKey(),
        studioVisualLanguageLookbookResourceKey(input.lookbookId),
      ],
    };
  });
}

function modelChoices(
  context: LookbookImageGenerationContext
): LookbookImageModelChoiceReport[] {
  const aspectRatio = context.project.aspectRatio;
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: aspectRatio !== '21:9',
      ...(aspectRatio === '21:9'
        ? {
            unavailableReason:
              'GPT Image 2 is not available for 21:9 Lookbook images because this slice only uses priced preset image sizes.',
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
              'Grok Imagine is not available for 21:9 Lookbook images because the schema does not expose exact 21:9.',
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
              'Seedream v5 Lite is not available for 21:9 Lookbook images until explicit tested dimensions are added.',
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
  spec: LookbookImageGenerationSpec
): LookbookImageGenerationSpec {
  if (spec.purpose !== LOOKBOOK_IMAGE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Unsupported generation purpose: ${spec.purpose}.`
    );
  }
  if (spec.target.kind !== 'lookbook') {
    throw new ProjectDataError(
      'PROJECT_DATA264',
      `Lookbook image generation requires target.kind "lookbook". Received: ${spec.target.kind}.`
    );
  }
  assertLookbookImageModelChoice(spec.modelChoice);
  const takeCount = spec.takeCount ?? 1;
  if (!Number.isInteger(takeCount) || takeCount < 1) {
    throw new ProjectDataError(
      'PROJECT_DATA265',
      'Lookbook image takeCount must be a positive integer.'
    );
  }
  const seed = spec.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new ProjectDataError(
      'PROJECT_DATA266',
      'Lookbook image seed must be a non-negative integer or null.'
    );
  }
  const imageFrame = spec.imageFrame ?? 'project';
  if (imageFrame !== 'project' && !PROJECT_ASPECT_RATIOS.has(imageFrame)) {
    throw new ProjectDataError(
      'PROJECT_DATA267',
      `Unsupported Lookbook image frame: ${imageFrame}.`
    );
  }
  const detail = spec.detail ?? 'standard';
  if (detail !== 'draft' && detail !== 'standard' && detail !== 'high') {
    throw new ProjectDataError(
      'PROJECT_DATA268',
      `Unsupported Lookbook image detail: ${detail}.`
    );
  }
  const outputFormat = spec.outputFormat ?? 'png';
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    throw new ProjectDataError(
      'PROJECT_DATA269',
      `Unsupported Lookbook image output format: ${outputFormat}.`
    );
  }
  return {
    ...spec,
    takeCount,
    seed,
    imageFrame,
    detail,
    outputFormat,
  };
}

export function buildLookbookImageProviderPayload(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
): ProviderPlan {
  assertLookbookSectionsForType(context.lookbook.type, spec.focusSections);
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
      return unsupportedLookbookImageModel(spec.modelChoice);
  }
}

function buildGptImage2Payload(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
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
      prompt: buildLookbookImagePrompt(spec, context),
      num_images: takeCount,
      image_size: mapPresetFrame(resolveFrame(spec, context), 'gpt-image-2'),
      quality: mapGptQuality(requireDetail(spec)),
      output_format: requireOutputFormat(spec),
      sync_mode: false,
    },
  };
}

function buildNanoBanana2Payload(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
): ProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2',
    outputCount: takeCount,
    payload: {
      prompt: buildLookbookImagePrompt(spec, context),
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
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
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
      prompt: buildLookbookImagePrompt(spec, context),
      num_images: takeCount,
      aspect_ratio: frame,
      output_format: requireOutputFormat(spec),
      sync_mode: false,
    },
  };
}

function buildSeedreamV5Payload(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
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
      prompt: buildLookbookImagePrompt(spec, context),
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

function buildLookbookImagePrompt(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
): string {
  return context.lookbook.type === 'storyboard'
    ? storyboardLookbookImagePrompt(spec, context)
    : movieLookbookImagePrompt(spec, context);
}

function movieLookbookImagePrompt(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
): string {
  const lookbook = context.lookbook;
  if (lookbook.type !== 'movie') {
    throw new ProjectDataError(
      'CORE_LOOKBOOK_TYPE_MISMATCH',
      `Movie Lookbook image prompt received a ${lookbook.type} Lookbook.`
    );
  }
  const definition = lookbook.definition;
  const sectionText = spec.focusSections
    .map((section) => movieSectionPromptText(section, definition))
    .join('\n');
  return [
    spec.prompt.trim(),
    '',
    `Create a Movie Lookbook image for ${lookbook.name}.`,
    `Visual thesis: ${definition.thesis.statement}`,
    sectionText,
    'The image should be a cinematic visual-language sample, not a storyboard drawing, UI collage, or generic mood board.',
  ].filter((line) => line.length > 0).join('\n');
}

function storyboardLookbookImagePrompt(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
): string {
  const lookbook = context.lookbook;
  if (lookbook.type !== 'storyboard') {
    throw new ProjectDataError(
      'CORE_LOOKBOOK_TYPE_MISMATCH',
      `Storyboard Lookbook image prompt received a ${lookbook.type} Lookbook.`
    );
  }
  const definition = lookbook.definition;
  const sectionText = spec.focusSections
    .map((section) => storyboardSectionPromptText(section, definition))
    .join('\n');
  return [
    spec.prompt.trim(),
    '',
    `Create a Storyboard Lookbook image for ${lookbook.name}.`,
    sectionText,
    'The image should be a storyboard style sample: drawing treatment, panel discipline, notation behavior, value strategy, or continuity clarity. Do not render a photoreal final film still.',
  ].filter((line) => line.length > 0).join('\n');
}

function movieSectionPromptText(
  section: LookbookImageGenerationSpec['focusSections'][number],
  definition: LookbookImageGenerationContext['lookbook']['definition']
): string {
  if ('styleBrief' in definition) {
    return '';
  }
  switch (section) {
    case 'thesis':
      return `Thesis: ${definition.thesis.statement}`;
    case 'palette':
      return `Palette: ${definition.palette.description}`;
    case 'toneMood':
      return `Tone and mood: ${definition.toneMood.tone}; ${definition.toneMood.description}`;
    case 'composition':
      return `Composition: ${definition.composition.description}`;
    case 'lighting':
      return `Lighting: ${definition.lighting.description}`;
    case 'texture':
      return `Texture: ${definition.texture.description}`;
    case 'camera':
      return `Camera: ${definition.camera.description}`;
    default:
      return '';
  }
}

function storyboardSectionPromptText(
  section: LookbookImageGenerationSpec['focusSections'][number],
  definition: LookbookImageGenerationContext['lookbook']['definition']
): string {
  if ('thesis' in definition) {
    return '';
  }
  switch (section) {
    case 'styleBrief':
      return `Style brief: ${definition.styleBrief.text}`;
    case 'lineAndFinish':
      return `Line and finish: ${definition.lineAndFinish.text}`;
    case 'valueAndAccent':
      return `Value and accent: ${definition.valueAndAccent.text}`;
    case 'guardrails':
      return `Guardrails: ${definition.guardrails.text}`;
    default:
      return '';
  }
}

function resolveFrame(
  spec: LookbookImageGenerationSpec,
  context: LookbookImageGenerationContext
): Exclude<LookbookImageFrame, 'project'> {
  const frame = spec.imageFrame ?? 'project';
  if (frame !== 'project') {
    return frame;
  }
  const projectFrame = context.project.aspectRatio;
  if (!projectFrame || !PROJECT_ASPECT_RATIOS.has(projectFrame)) {
    throw new ProjectDataError(
      'PROJECT_DATA270',
      'Lookbook image frame is set to project, but the project has no supported aspect ratio.'
    );
  }
  return projectFrame as Exclude<LookbookImageFrame, 'project'>;
}

function mapPresetFrame(
  frame: Exclude<LookbookImageFrame, 'project'>,
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

function mapGptQuality(detail: LookbookImageDetail): 'low' | 'medium' | 'high' {
  if (detail === 'draft') {
    return 'low';
  }
  if (detail === 'standard') {
    return 'medium';
  }
  return 'high';
}

function mapNanoBananaResolution(detail: LookbookImageDetail): '1K' | '2K' | '4K' {
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
  spec: LookbookImageGenerationSpec
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

function requireTakeCount(spec: LookbookImageGenerationSpec, max: number): number {
  const takeCount = spec.takeCount ?? 1;
  if (takeCount > max) {
    unsupported(`Selected model supports at most ${max} takes per run.`);
  }
  return takeCount;
}

function requireDetail(spec: LookbookImageGenerationSpec): LookbookImageDetail {
  return spec.detail ?? 'standard';
}

function requireOutputFormat(
  spec: LookbookImageGenerationSpec
): LookbookImageOutputFormat {
  return spec.outputFormat ?? 'png';
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}

function assertLookbookImageModelChoice(
  modelChoice: string
): asserts modelChoice is LookbookImageModelChoice {
  if (!LOOKBOOK_IMAGE_MODEL_CHOICES.has(modelChoice)) {
    unsupportedLookbookImageModel(modelChoice);
  }
}

function assertLookbookImageSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is LookbookImageGenerationSpec {
  if (spec.purpose !== LOOKBOOK_IMAGE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
}

function unsupportedLookbookImageModel(modelChoice: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA274',
    `Unsupported Lookbook image model: ${modelChoice}.`
  );
}

function titleForSpec(spec: LookbookImageGenerationSpec): string {
  return spec.title?.trim() || spec.prompt.trim().slice(0, 80) || 'Lookbook image';
}

function outputNames(spec: LookbookImageGenerationSpec, count: number): string[] {
  const base = slugify(titleForSpec(spec));
  const extension = extensionForOutputFormat(requireOutputFormat(spec));
  return Array.from({ length: count }, (_, index) =>
    count === 1
      ? `${base}${extension}`
      : `${base}-${String(index + 1).padStart(2, '0')}${extension}`
  );
}

function extensionForOutputFormat(format: LookbookImageOutputFormat): string {
  return format === 'jpeg' ? '.jpg' : `.${format}`;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'lookbook-image';
}

async function readProjectInformationForInput(input: LookbookImageProjectInput) {
  return withProjectSession(input, ({ session }) =>
    readProjectInformationResourceFromDatabase(session)
  );
}

export async function resolveLookbookImageGenerationOutputPaths(input: LookbookImageProjectInput) {
  return withProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
    };
  });
}

async function withProjectSession<T>(
  input: LookbookImageProjectInput,
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

async function importLookbookImageFile(input: {
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
    type: 'lookbook_image',
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
