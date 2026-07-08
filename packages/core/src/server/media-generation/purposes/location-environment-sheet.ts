import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  LocationEnvironmentSheetGenerationContext,
  LocationEnvironmentSheetGenerationSpec,
  LocationEnvironmentSheetMediaImportReport,
  LocationEnvironmentSheetModelChoice,
  LocationEnvironmentSheetModelChoiceReport,
  LocationEnvironmentSheetModelListReport,
  LocationEnvironmentSheetOutputFormat,
  LocationGenerationAssetFileReference,
  LocationGenerationScreenplayContext,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type { Block, Scene } from '../../../client/screenplay.js';
import { insertAssetFileRecord } from '../../database/access/asset-files.js';
import { insertAssetRecord } from '../../database/access/assets.js';
import {
  insertAssetRelationshipRecord,
  listAssetRelationshipPage,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
} from '../../database/access/asset-relationships/index.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import {
  readActiveLocationDesignDocument,
  toLocationDesignSummary,
} from '../../database/access/department-design.js';
import {
  listLookbookCardImageIds,
  readSelectedMovieLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../../database/access/lookbook.js';
import { listLookbookImages, readLookbookImage } from '../../database/access/lookbook-images.js';
import { readLocationRecord } from '../../database/access/locations.js';
import { readProjectInformationResourceFromDatabase } from '../../database/access/project-information.js';
import { readProjectRecord, type ProjectRecord } from '../../database/access/project.js';
import { readScreenplayDocumentFromSession } from '../../database/access/screenplay-resource.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../../entity-ids.js';
import {
  LOCATIONS_ROOT,
  allocateProjectRelativeVersionedFilePath,
  kebabCasePathSegment,
} from '../../files/asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { buildSavedImageGenerationPreview } from '../../generation-preview/saved-image-preview.js';
import { providerPreviewPromptText } from '../../generation-preview/provider-preview-prompt.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';
import { estimateMediaGenerationSpecRecordCost } from '../cost/cost-projection.js';
import {
  mediaGenerationEstimateWithApproval,
  mediaGenerationRunApprovalToken,
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from '../cost/cost-approval.js';
import type {
  MediaGenerationDependencyDraftSpec,
  MediaGenerationDependencyDraftSpecInput,
} from '../dependencies/dependency-draft-specs.js';
import { studioResourceKeysForAssetTarget } from '../../studio-coordination/resource-keys.js';
import {
  mapGptQuality,
  mapNanoBananaResolution,
} from './cast-image-common.js';

const LOCATION_ENVIRONMENT_SHEET_MODELS = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

const OUTPUT_FORMATS = new Set<LocationEnvironmentSheetOutputFormat>([
  'png',
  'jpeg',
  'webp',
]);

interface LocationProviderPlan {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  mode: 'text-to-image';
  payload: Record<string, unknown>;
  outputCount: 1;
}

export interface LocationEnvironmentSheetProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface LocationEnvironmentSheetTargetInput
  extends LocationEnvironmentSheetProjectInput {
  locationId: string;
}

export interface LocationEnvironmentSheetSpecFileInput
  extends LocationEnvironmentSheetProjectInput {
  spec: LocationEnvironmentSheetGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface LocationEnvironmentSheetSpecIdInput
  extends LocationEnvironmentSheetProjectInput {
  specId: string;
}

export interface UpdateLocationEnvironmentSheetSpecInput
  extends LocationEnvironmentSheetSpecIdInput {
  spec: LocationEnvironmentSheetGenerationSpec;
}

export interface RunLocationEnvironmentSheetSpecInput
  extends LocationEnvironmentSheetSpecIdInput {
  approvalToken?: string;
  simulate?: boolean;
  approveUnpricedCost?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface RecordLocationEnvironmentSheetRunInput
  extends LocationEnvironmentSheetSpecIdInput {
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

export interface ImportLocationEnvironmentSheetMediaInput
  extends LocationEnvironmentSheetTargetInput {
  sourceProjectRelativePath: string;
  title?: string;
  description: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export async function buildLocationEnvironmentSheetContext(
  input: LocationEnvironmentSheetTargetInput
): Promise<LocationEnvironmentSheetGenerationContext> {
  const projectContext = await readLocationProjectContext(input);
  return withLocationProjectSession(input, ({ session, projectFolder }) => {
    const location = requireLocationForContext(session, input.locationId);
    const activeLookbook = requireActiveLookbookContext(session);
    const activeLocationDesign = readActiveLocationDesignDocument(session, input.locationId);
    const assets = readLocationAssetsByRole(session, input.locationId);
    return {
      purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
      target: { kind: 'location', id: input.locationId },
      project: projectContext,
      screenplay: buildLocationScreenplayContext(session),
      location,
      activeLocationDesign: activeLocationDesign
        ? toLocationDesignSummary({
            id: activeLocationDesign.id,
            document: activeLocationDesign.document,
          })
        : null,
      usage: buildLocationUsageContext(session, input.locationId),
      activeLookbook,
      selectedAssets: assets.selectedAssets,
      environmentSheetTakes: assets.environmentSheetTakes,
      referenceAssets: assets.referenceAssets,
      imageFiles: locationImageFileReferences(projectFolder, [
        ...assets.selectedAssets,
        ...assets.environmentSheetTakes,
        ...assets.referenceAssets,
      ]),
      defaults: {
        takeCount: 1,
        seed: null,
        sheetFrame: '4:3',
        detail: 'standard',
        outputFormat: 'png',
      },
      historicalGuardrailInputs: {
        timePeriod: location.timePeriod ?? null,
        historicalBasis: projectContextFromScreenplay(session, 'historicalBasis'),
        dramatizedElements: projectContextFromScreenplay(session, 'dramatizedElements'),
        researchSources: projectContextFromScreenplay(session, 'researchSources'),
        assumptionsMade: projectContextFromScreenplay(session, 'assumptionsMade'),
      },
      resourceKeys: studioResourceKeysForAssetTarget({
        kind: 'location',
        locationId: input.locationId,
      }),
    };
  });
}

export async function listLocationEnvironmentSheetModels(
  input: LocationEnvironmentSheetTargetInput
): Promise<LocationEnvironmentSheetModelListReport> {
  const context = await buildLocationEnvironmentSheetContext(input);
  return {
    purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
    target: context.target,
    models: modelChoices(),
  };
}

export async function validateLocationEnvironmentSheetSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LocationEnvironmentSheetGenerationSpec;
}): Promise<{
  valid: true;
  spec: LocationEnvironmentSheetGenerationSpec;
  providerPayload: Record<string, unknown>;
}> {
  const normalized = await normalizeSpec(input);
  const context = await buildLocationEnvironmentSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: normalized.target.id,
  });
  const plan = buildLocationEnvironmentSheetProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createLocationEnvironmentSheetSpec(
  input: LocationEnvironmentSheetSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateLocationEnvironmentSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withLocationProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized, 'Location environment sheet'),
      now: new Date().toISOString(),
    });
  });
}

export async function updateLocationEnvironmentSheetSpec(
  input: UpdateLocationEnvironmentSheetSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateLocationEnvironmentSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withLocationProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized, 'Location environment sheet'),
      now: new Date().toISOString(),
    })
  );
}

export async function readLocationEnvironmentSheetSpec(
  input: LocationEnvironmentSheetSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withLocationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listLocationEnvironmentSheetSpecs(
  input: LocationEnvironmentSheetTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withLocationProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
      targetKind: 'location',
      targetId: input.locationId,
    }),
  }));
}

export async function prepareLocationEnvironmentSheetSpec(
  input: LocationEnvironmentSheetSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readLocationEnvironmentSheetSpec(input);
  assertLocationEnvironmentSheetSpec(specRecord.spec);
  const context = await buildLocationEnvironmentSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: specRecord.spec.target.id,
  });
  const plan = buildLocationEnvironmentSheetProviderPayload(
    specRecord.spec,
    context
  );
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function buildLocationEnvironmentSheetGenerationPreview(
  input: {
    projectName?: string;
    homeDir?: string;
    specRecord: MediaGenerationSpecRecord;
  }
) {
  const { specRecord } = input;
  assertLocationEnvironmentSheetSpec(specRecord.spec);
  const context = await buildLocationEnvironmentSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: specRecord.spec.target.id,
  });
  const plan = buildLocationEnvironmentSheetProviderPayload(
    specRecord.spec,
    context
  );
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
    project: context.project,
    target: specRecord.target,
    title: specRecord.title,
    modelChoice: specRecord.spec.modelChoice,
    modelLabel:
      modelChoices().find(
        (model) => model.modelChoice === specRecord.spec.modelChoice
      )?.label ?? specRecord.spec.modelChoice,
    provider: plan.provider,
    providerModel: plan.model,
    mode: 'text-to-image',
    prompt: providerPreviewPromptText(plan.payload, specRecord.spec.prompt),
    references: [],
    payload: plan.payload,
  });
}

export async function prepareLocationEnvironmentSheetDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LocationEnvironmentSheetGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const context = await buildLocationEnvironmentSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: normalized.target.id,
  });
  const plan = buildLocationEnvironmentSheetProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

export async function buildLocationEnvironmentSheetDependencyDraftSpec(
  input: MediaGenerationDependencyDraftSpecInput
): Promise<MediaGenerationDependencyDraftSpec> {
  if (input.dependencyTarget.kind !== 'location') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `location.environment-sheet dependency requires a location target. Received: ${input.dependencyTarget.kind}.`
    );
  }
  const context = await buildLocationEnvironmentSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: input.dependencyTarget.id,
  });
  return {
    purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
    spec: {
      purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
      target: input.dependencyTarget,
      modelChoice: 'fal-ai/openai/gpt-image-2',
      prompt: [
        `Create a production environment sheet for ${context.location.name}.`,
        input.reason,
        'Translate the project visual language and location design into visible architecture, geography, materials, surfaces, lighting, atmosphere, scale cues, and continuity views. Make the sheet useful as a video reference image.',
      ].join(' '),
      takeCount: 1,
      seed: null,
      sheetFrame: '4:3',
      detail: 'standard',
      outputFormat: 'png',
      title: input.label,
      description: input.reason,
    },
    materializationState: 'generatable',
  };
}

export async function runLocationEnvironmentSheetSpec(
  input: RunLocationEnvironmentSheetSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareLocationEnvironmentSheetSpec(input);
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
  const outputPaths = await resolveLocationGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  return recordLocationEnvironmentSheetRun({
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

export async function recordLocationEnvironmentSheetRun(
  input: RecordLocationEnvironmentSheetRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readLocationEnvironmentSheetSpec(input);
  assertLocationEnvironmentSheetSpec(specRecord.spec);
  const now = new Date().toISOString();
  const run = await withLocationProjectSession(input, ({ session }) => {
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

export async function importLocationEnvironmentSheetMedia(
  input: ImportLocationEnvironmentSheetMediaInput
): Promise<LocationEnvironmentSheetMediaImportReport> {
  return withLocationProjectSession(input, async ({ session, projectFolder, project }) => {
    const location = requireLocationForContext(session, input.locationId);
    const sourceProjectRelativePath = normalizeProjectRelativePath(
      input.sourceProjectRelativePath
    );
    await validateImportSourceFile(projectFolder, sourceProjectRelativePath);
    const description = requiredTrimmed(
      input.description,
      'Location Sheet description'
    );
    const now = new Date().toISOString();
    const destinationProjectRelativePath = await allocateLocationEnvironmentSheetPath({
      projectFolder,
      locationHandle: location.handle,
      title: input.title ?? path.parse(sourceProjectRelativePath).name,
      extension: extensionForSource(sourceProjectRelativePath),
    });
    const importedFile = await copyLocationEnvironmentSheetFile({
      projectFolder,
      sourceProjectRelativePath,
      destinationProjectRelativePath,
    });
    const imported = await insertImportedLocationEnvironmentSheet({
      session,
      locationId: input.locationId,
      file: importedFile,
      title: input.title,
      description,
      origin: input.receipt ? 'generated' : inferImportOrigin(sourceProjectRelativePath),
      idGenerator: input.idGenerator,
      now,
    });
    const target = { kind: 'location' as const, locationId: input.locationId };
    const asset = readAssetRelationship(session, {
      target,
      assetId: imported.assetId,
    });
    if (!asset) {
      throw new ProjectDataError(
        'PROJECT_DATA078',
        `Asset ${imported.assetId} is not attached to the requested location.`
      );
    }
    const resourceKeys = studioResourceKeysForAssetTarget(target);
    return {
      valid: true,
      warnings: [],
      project: {
        id: project.id,
        name: project.name,
        projectFolder,
      },
      changes: [
        { type: 'location.environmentSheetImported', locationId: input.locationId },
      ],
      purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
      target: { kind: 'location', id: input.locationId },
      imported: asset,
      files: [
        {
          role: 'primary',
          projectRelativePath: importedFile.projectRelativePath,
        },
      ],
      resourceKeys,
    };
  });
}

export function buildLocationEnvironmentSheetProviderPayload(
  spec: LocationEnvironmentSheetGenerationSpec,
  _context: LocationEnvironmentSheetGenerationContext
): LocationProviderPlan {
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return buildGptImage2Payload(spec);
    case 'fal-ai/nano-banana-2':
      return buildNanoBanana2Payload(spec);
    case 'fal-ai/xai/grok-imagine-image':
      return buildGrokImaginePayload(spec);
    default:
      throw unsupportedModel(spec.modelChoice);
  }
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LocationEnvironmentSheetGenerationSpec;
}): Promise<LocationEnvironmentSheetGenerationSpec> {
  if (input.spec.purpose !== LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Unsupported generation purpose: ${input.spec.purpose}.`
    );
  }
  assertAllowedSpecFields(input.spec);
  validateLocationTarget(input.spec.target);
  assertModelChoice(input.spec.modelChoice);
  if (input.spec.prompt.trim().length === 0) {
    throw new ProjectDataError(
      'PROJECT_DATA301',
      'Location environment sheet prompt cannot be empty.'
    );
  }
  const description = requiredTrimmed(
    input.spec.description,
    'Location environment sheet description'
  );
  const takeCount = input.spec.takeCount ?? 1;
  if (takeCount !== 1) {
    throw new ProjectDataError(
      'PROJECT_DATA302',
      'Location environment sheet takeCount must be exactly 1.'
    );
  }
  const seed = input.spec.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new ProjectDataError(
      'PROJECT_DATA303',
      'Location environment sheet seed must be a non-negative integer or null.'
    );
  }
  const sheetFrame = input.spec.sheetFrame ?? '4:3';
  if (sheetFrame !== '4:3') {
    throw new ProjectDataError(
      'PROJECT_DATA304',
      `Unsupported location environment sheet frame: ${sheetFrame}.`
    );
  }
  const detail = input.spec.detail ?? 'standard';
  if (detail !== 'draft' && detail !== 'standard' && detail !== 'high') {
    throw new ProjectDataError(
      'PROJECT_DATA305',
      `Unsupported location environment sheet detail: ${detail}.`
    );
  }
  const outputFormat = input.spec.outputFormat ?? 'png';
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    throw new ProjectDataError(
      'PROJECT_DATA306',
      `Unsupported location environment sheet output format: ${outputFormat}.`
    );
  }
  await withLocationProjectSession(input, ({ session }) => {
    requireLocationForContext(session, input.spec.target.id);
    requireActiveLookbookContext(session);
  });
  return {
    ...input.spec,
    prompt: input.spec.prompt.trim(),
    takeCount: 1,
    seed,
    sheetFrame,
    detail,
    outputFormat,
    description,
  };
}

function assertAllowedSpecFields(spec: LocationEnvironmentSheetGenerationSpec): void {
  const record = spec as unknown as Record<string, unknown>;
  const allowed = new Set([
    'purpose',
    'target',
    'modelChoice',
    'prompt',
    'takeCount',
    'seed',
    'sheetFrame',
    'detail',
    'outputFormat',
    'title',
    'description',
  ]);
  const unexpected = Object.keys(record).filter((field) => !allowed.has(field));
  if (unexpected.length) {
    throw new ProjectDataError(
      'PROJECT_DATA307',
      `Location environment sheet spec contains unsupported fields: ${unexpected.join(', ')}.`
    );
  }
}

function buildGptImage2Payload(
  spec: LocationEnvironmentSheetGenerationSpec
): LocationProviderPlan {
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('GPT Image 2 does not support generation seed.');
  }
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2',
    mode: 'text-to-image',
    outputCount: 1,
    payload: {
      prompt: spec.prompt,
      num_images: 1,
      image_size: 'landscape_4_3',
      quality: mapGptQuality(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function buildNanoBanana2Payload(
  spec: LocationEnvironmentSheetGenerationSpec
): LocationProviderPlan {
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2',
    mode: 'text-to-image',
    outputCount: 1,
    payload: {
      prompt: spec.prompt,
      num_images: 1,
      seed: spec.seed ?? null,
      aspect_ratio: '4:3',
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
  spec: LocationEnvironmentSheetGenerationSpec
): LocationProviderPlan {
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('Grok Imagine does not support generation seed.');
  }
  if ((spec.detail ?? 'standard') !== 'standard') {
    unsupported('Grok Imagine supports only standard detail.');
  }
  return {
    provider: 'fal-ai',
    model: 'xai/grok-imagine-image',
    mode: 'text-to-image',
    outputCount: 1,
    payload: {
      prompt: spec.prompt,
      num_images: 1,
      aspect_ratio: '4:3',
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function toGenerationRequest(
  plan: LocationProviderPlan,
  spec: LocationEnvironmentSheetGenerationSpec
): PreparedMediaGeneration['generation'] {
  const { prompt, ...parameters } = plan.payload;
  return {
    policy: {
      provider: plan.provider,
      model: plan.model,
      mediaKind: 'image',
      mode: plan.mode,
      outputCount: 1,
    },
    request: {
      prompt: typeof prompt === 'string' ? prompt : spec.prompt,
      parameters,
      outputNames: [
        `${slugify(titleForSpec(spec, 'Location environment sheet'))}${extensionForOutputFormat(spec.outputFormat ?? 'png')}`,
      ],
    },
  };
}

function modelChoices(): LocationEnvironmentSheetModelChoiceReport[] {
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: true,
      supportsSeed: false,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedSheetFrames: ['4:3'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/nano-banana-2',
      label: 'Nano Banana 2',
      available: true,
      supportsSeed: true,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedSheetFrames: ['4:3'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      label: 'Grok Imagine',
      available: true,
      supportsSeed: false,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedSheetFrames: ['4:3'],
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
  ];
}

async function withLocationProjectSession<T>(
  input: LocationEnvironmentSheetProjectInput,
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

async function readLocationProjectContext(
  input: LocationEnvironmentSheetProjectInput
) {
  return withLocationProjectSession(input, ({ session, project }) => {
    const info = readProjectInformationResourceFromDatabase(session);
    return {
      id: project.id,
      name: project.name,
      title: info.title,
      aspectRatio: info.aspectRatio ?? '16:9',
      logline: info.logline ?? null,
      summary: info.summary ?? null,
      languages: info.languages,
    };
  });
}

function buildLocationScreenplayContext(
  session: DatabaseSession
): LocationGenerationScreenplayContext | null {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    return null;
  }
  const screenplay = document.screenplay;
  return {
    title: screenplay.title,
    intendedAudience: screenplay.intendedAudience,
    genrePrimary: screenplay.genrePrimary,
    genreSecondary: screenplay.genreSecondary,
    tone: screenplay.tone,
    logline: screenplay.logline,
    summary: screenplay.summary,
    premiseOverview: screenplay.premiseOverview,
    centralConflict: screenplay.centralConflict,
    dramaticQuestion: screenplay.dramaticQuestion,
    themes: screenplay.themes,
    historicalBasis: screenplay.historicalBasis,
    dramatizedElements: screenplay.dramatizedElements,
    researchSources: screenplay.researchSources,
    assumptionsMade: screenplay.assumptionsMade,
  };
}

function buildLocationUsageContext(session: DatabaseSession, locationId: string) {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    return { scenes: [] };
  }
  const scenes: LocationEnvironmentSheetGenerationContext['usage']['scenes'] = [];
  for (const act of document.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (!scene.id || !sceneReferencesLocation(scene, locationId)) {
          continue;
        }
        scenes.push({
          sceneId: scene.id,
          title: scene.title,
          setting: scene.setting,
          storyFunction: scene.storyFunction,
          excerpts: scene.blocks
            .filter((block) => blockReferencesLocation(block, locationId))
            .flatMap(blockExcerpt)
            .slice(0, 4),
        });
      }
    }
  }
  return { scenes };
}

function sceneReferencesLocation(scene: Scene, locationId: string): boolean {
  return (
    scene.setting.locationIds?.includes(locationId) === true ||
    scene.blocks.some((block) => blockReferencesLocation(block, locationId))
  );
}

function blockReferencesLocation(block: Block, locationId: string): boolean {
  return block.locationIds?.includes(locationId) === true;
}

function blockExcerpt(block: Block): string[] {
  if ('text' in block && block.text) {
    return [block.text];
  }
  if ('lines' in block) {
    return block.lines;
  }
  return [];
}

function projectContextFromScreenplay(
  session: DatabaseSession,
  field:
    | 'historicalBasis'
    | 'dramatizedElements'
    | 'researchSources'
    | 'assumptionsMade'
): string[] {
  const document = readScreenplayDocumentFromSession(session);
  return document?.screenplay[field] ?? [];
}

function requireLocationForContext(session: DatabaseSession, locationId: string) {
  const row = readLocationRecord(session, locationId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA311',
      `Location environment sheet generation requires a screenplay location, but the requested location was not found: ${locationId}.`,
      {
        suggestion:
          'Add the historical location to the screenplay locations list, including its time period and visual notes, then generate the location environment sheet.',
      }
    );
  }
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    timePeriod: row.timePeriod ?? undefined,
    description: row.description ?? undefined,
    visualNotes: row.visualNotes ?? undefined,
  };
}

function requireActiveLookbookContext(session: DatabaseSession) {
  const activeLookbookId = readSelectedMovieLookbookId(session);
  if (!activeLookbookId) {
    throw new ProjectDataError(
      'PROJECT_DATA312',
      'Location environment sheet generation requires a selected Movie Lookbook.',
      {
        suggestion:
          'Create or select a Movie Lookbook before generating location environment sheets.',
      }
    );
  }
  const row = requireLookbookRecordById(session, activeLookbookId);
  const lookbook = toLookbook(row);
  if (lookbook.type !== 'movie') {
    throw new ProjectDataError(
      'CORE_LOOKBOOK_TYPE_MISMATCH',
      `Selected Movie Lookbook ${activeLookbookId} is not a Movie Lookbook.`
    );
  }
  const cardImageId = listLookbookCardImageIds(session).get(row.id);
  return {
    lookbook,
    cardImage: cardImageId
      ? readLookbookImage(session, cardImageId)
      : listLookbookImages(session, row.id)[0] ?? null,
    isActive: true as const,
  };
}

function readLocationAssetsByRole(
  session: DatabaseSession,
  locationId: string
): {
  selectedAssets: Asset[];
  environmentSheetTakes: Asset[];
  referenceAssets: Asset[];
} {
  const target = { kind: 'location' as const, locationId };
  const selectedAssets = listAssetRelationshipPage(session, {
    target,
    selection: 'select',
    limit: 200,
  }).items;
  const environmentSheetTakes = listAssetRelationshipPage(session, {
    target,
    role: 'environment_sheet',
    selection: 'take',
    limit: 200,
  }).items;
  return {
    selectedAssets,
    environmentSheetTakes,
    referenceAssets: selectedAssets.filter((asset) => asset.role !== 'environment_sheet'),
  };
}

function locationImageFileReferences(
  projectFolder: string,
  assets: Asset[]
): LocationGenerationAssetFileReference[] {
  const references: LocationGenerationAssetFileReference[] = [];
  const seenAssetFileIds = new Set<string>();
  for (const asset of assets) {
    for (const file of asset.files) {
      if (file.mediaKind !== 'image' || seenAssetFileIds.has(file.id)) {
        continue;
      }
      seenAssetFileIds.add(file.id);
      references.push({
        assetId: asset.assetId,
        assetFileId: file.id,
        role: file.role,
        projectRelativePath: file.projectRelativePath,
        absolutePath: resolveProjectRelativePath(
          projectFolder,
          file.projectRelativePath
        ),
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
      });
    }
  }
  return references;
}

function validateLocationTarget(
  target: LocationEnvironmentSheetGenerationSpec['target']
): void {
  if (target.kind !== 'location') {
    throw new ProjectDataError(
      'PROJECT_DATA313',
      `Location environment sheet generation requires target.kind "location". Received: ${target.kind}.`
    );
  }
}

function assertModelChoice(
  modelChoice: string
): asserts modelChoice is LocationEnvironmentSheetModelChoice {
  if (!LOCATION_ENVIRONMENT_SHEET_MODELS.has(modelChoice)) {
    throw unsupportedModel(modelChoice);
  }
}

function unsupportedModel(modelChoice: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA314',
    `Unsupported Location environment sheet model: ${modelChoice}.`
  );
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}

function assertLocationEnvironmentSheetSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is LocationEnvironmentSheetGenerationSpec {
  if (spec.purpose !== LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
}

async function resolveLocationGenerationOutputPaths(
  input: LocationEnvironmentSheetProjectInput
) {
  return withLocationProjectSession(input, ({ session, projectFolder }) => {
    const specId = 'specId' in input && typeof input.specId === 'string' ? input.specId : '';
    const specRecord = specId ? requireMediaGenerationSpec(session, specId) : null;
    const target = specRecord?.spec && typeof specRecord.spec === 'object'
      ? (specRecord.spec as { target?: { id?: unknown } }).target
      : undefined;
    const locationId = typeof target?.id === 'string' ? target.id : '';
    const location = locationId ? requireLocationForContext(session, locationId) : null;
    const projectRelativeRoot = joinProjectRelativePath(
      LOCATIONS_ROOT,
      location?.handle ?? 'location',
      'environment-sheets'
    );
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}

async function validateImportSourceFile(
  projectFolder: string,
  sourceProjectRelativePath: ProjectRelativePath
): Promise<void> {
  const sourcePath = resolveProjectRelativePath(projectFolder, sourceProjectRelativePath);
  assertResolvedPathInsideProject(projectFolder, sourcePath);
  await statExistingFile(sourcePath);
  if (!isImagePath(sourceProjectRelativePath)) {
    throw unsupportedImportImagePath(sourceProjectRelativePath);
  }
}

async function copyLocationEnvironmentSheetFile(input: {
  projectFolder: string;
  sourceProjectRelativePath: ProjectRelativePath;
  destinationProjectRelativePath: ProjectRelativePath;
}): Promise<{
  projectRelativePath: ProjectRelativePath;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
}> {
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    input.sourceProjectRelativePath
  );
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    input.destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }
  const stats = await statExistingFile(destinationPath);
  return {
    projectRelativePath: input.destinationProjectRelativePath,
    mimeType: mimeTypeForPath(input.destinationProjectRelativePath),
    sizeBytes: stats.size,
    contentHash: await hashFile(destinationPath),
  };
}

async function insertImportedLocationEnvironmentSheet(input: {
  session: DatabaseSession;
  locationId: string;
  file: {
    projectRelativePath: ProjectRelativePath;
    mimeType: string;
    sizeBytes: number;
    contentHash: string;
  };
  title?: string;
  description: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const assetId = ids('asset');
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    insertAssetRecord(txSession, {
      id: assetId,
      type: 'location_environment_sheet',
      mediaKind: 'image',
      title: input.title?.trim() || path.parse(input.file.projectRelativePath).name,
      oneLineSummary: input.description,
      origin: input.origin,
      availability: 'ready',
      createdAt: input.now,
      updatedAt: input.now,
    });
    insertAssetFileRecord(txSession, {
      id: ids('asset_file'),
      assetId,
      role: 'primary',
      projectRelativePath: input.file.projectRelativePath,
      mediaKind: 'image',
      mimeType: input.file.mimeType,
      sizeBytes: input.file.sizeBytes,
      contentHash: input.file.contentHash,
      createdAt: input.now,
      updatedAt: input.now,
    });
    const target = { kind: 'location' as const, locationId: input.locationId };
    insertAssetRelationshipRecord(txSession, target, {
      relationshipId: ids('location_asset'),
      assetId,
      localeId: null,
      role: 'environment_sheet',
      sortOrder: nextAssetRelationshipSortOrder(txSession, {
        target,
        role: 'environment_sheet',
        localeId: null,
      }),
      now: input.now,
    });
  });
  return { assetId };
}

async function allocateLocationEnvironmentSheetPath(input: {
  projectFolder: string;
  locationHandle: string;
  title: string;
  extension: string;
}): Promise<ProjectRelativePath> {
  const parent = joinProjectRelativePath(
    LOCATIONS_ROOT,
    input.locationHandle,
    'environment-sheets'
  );
  return allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent,
    baseName: kebabCasePathSegment(input.title, 'environment-sheet'),
    extension: input.extension,
  });
}

function inferImportOrigin(sourceProjectRelativePath: ProjectRelativePath): string {
  return sourceProjectRelativePath.startsWith('tmp/media/') ? 'generated' : 'imported';
}

function titleForSpec(
  spec: LocationEnvironmentSheetGenerationSpec,
  fallback: string
): string {
  return spec.title?.trim() || spec.prompt.trim().slice(0, 80) || fallback;
}

function requiredTrimmed(input: string | null | undefined, fieldName: string): string {
  const value = input?.trim();
  if (!value) {
    throw new ProjectDataError('PROJECT_DATA081', `${fieldName} cannot be empty.`);
  }
  return value;
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'location-environment-sheet';
}

function extensionForOutputFormat(format: LocationEnvironmentSheetOutputFormat): string {
  return format === 'jpeg' ? '.jpg' : `.${format}`;
}

function extensionForSource(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpeg') {
    return '.jpg';
  }
  if (extension === '.jpg' || extension === '.png' || extension === '.webp') {
    return extension;
  }
  throw unsupportedImportImagePath(filePath);
}

function isImagePath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.png' || extension === '.jpg' || extension === '.jpeg' || extension === '.webp';
}

function mimeTypeForPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  throw unsupportedImportImagePath(filePath);
}

function unsupportedImportImagePath(filePath: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA310',
    `Location environment sheet import file must be a png, jpg, jpeg, or webp image: ${filePath}.`
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

function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA245',
      `Media import source file must be inside the project folder: ${absolutePath}.`
    );
  }
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

async function loadGenerationEngines() {
  return import('@gorenku/studio-engines');
}
