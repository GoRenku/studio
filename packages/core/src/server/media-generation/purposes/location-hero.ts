import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  LocationGenerationAssetFileReference,
  LocationHeroGenerationContext,
  LocationHeroGenerationSpec,
  LocationHeroMediaImportReport,
  LocationHeroModelChoice,
  LocationHeroModelChoiceReport,
  LocationHeroModelListReport,
  LocationHeroOutputFormat,
  MediaGenerationRun,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
  GenerationPreviewRequestReference,
} from '../../../client/index.js';
import {
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
} from '../../../client/index.js';
import { insertAssetFileRecord } from '../../database/access/asset-files.js';
import { insertAssetRecord } from '../../database/access/assets.js';
import {
  insertAssetRelationshipRecord,
  listAssetRelationshipPage,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
  updateAssetRelationshipSelection,
} from '../../database/access/asset-relationships/index.js';
import {
  readActiveLocationDesignDocument,
  toLocationDesignSummary,
} from '../../database/access/department-design.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import { readLocationRecord } from '../../database/access/locations.js';
import {
  listLookbookCardImageIds,
  readSelectedMovieLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../../database/access/lookbook.js';
import { listLookbookImages, readLookbookImage } from '../../database/access/lookbook-images.js';
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
import { LOCATIONS_ROOT } from '../../files/asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { RenkuConfigPathOptions } from '../../renku-config.js';
import { buildSavedImageGenerationPreview } from '../../generation-preview/saved-image-preview.js';
import { providerPreviewPromptText } from '../../generation-preview/provider-preview-prompt.js';
import type { LocationHeroMutationReport } from '../../project-data-service-contracts.js';
import { studioResourceKeysForAssetTarget } from '../../studio-coordination/resource-keys.js';
import {
  mapGptQuality,
  mapNanoBananaResolution,
} from './cast-image-common.js';
import { draftMediaGenerationSpecRecord } from '../cost/draft-generation.js';
import { estimateMediaGenerationSpecRecordCost } from '../cost/cost-projection.js';
import {
  mediaGenerationEstimateWithApproval,
  mediaGenerationRunApprovalToken,
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from '../cost/cost-approval.js';

const LOCATION_HERO_MODELS = new Set<string>([
  'fal-ai/openai/gpt-image-2/edit',
  'fal-ai/nano-banana-2/edit',
  'fal-ai/xai/grok-imagine-image/edit',
]);

const OUTPUT_FORMATS = new Set<LocationHeroOutputFormat>([
  'png',
  'jpeg',
  'webp',
]);

interface LocationHeroProviderPlan {
  provider: 'fal-ai';
  model: string;
  mode: 'image-edit';
  payload: Record<string, unknown>;
  inputFiles: PreparedMediaGeneration['generation']['request']['inputFiles'];
  outputCount: 1;
}

export interface LocationHeroProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface LocationHeroTargetInput extends LocationHeroProjectInput {
  locationId: string;
  sourceLocationSheetAssetId?: string;
}

export interface LocationHeroSpecFileInput extends LocationHeroProjectInput {
  spec: LocationHeroGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}

export interface LocationHeroSpecIdInput extends LocationHeroProjectInput {
  specId: string;
}

export interface UpdateLocationHeroSpecInput extends LocationHeroSpecIdInput {
  spec: LocationHeroGenerationSpec;
}

export interface RunLocationHeroSpecInput extends LocationHeroSpecIdInput {
  approvalToken?: string;
  simulate?: boolean;
  approveUnpricedCost?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export interface RecordLocationHeroRunInput extends LocationHeroSpecIdInput {
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

export interface ImportLocationHeroMediaInput extends LocationHeroTargetInput {
  sourceProjectRelativePath: string;
  sourceLocationSheetAssetId: string;
  title?: string;
  description: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface GenerateLocationHeroFromSheetInput extends LocationHeroTargetInput {
  sourceLocationSheetAssetId: string;
  approvalToken?: string;
  simulate?: boolean;
  approveUnpricedCost?: boolean;
  idGenerator?: ProjectIdGenerator;
}

export async function buildLocationHeroContext(
  input: LocationHeroTargetInput
): Promise<LocationHeroGenerationContext> {
  const projectContext = await readLocationProjectContext(input);
  return withLocationProjectSession(input, ({ session, projectFolder }) => {
    const location = requireLocationForContext(session, input.locationId);
    const activeLocationDesign = readActiveLocationDesignDocument(session, input.locationId);
    const assets = readLocationAssetsByRole(session, input.locationId);
    const sourceLocationSheetAsset = input.sourceLocationSheetAssetId
      ? requireSourceLocationSheetAsset(session, {
          locationId: input.locationId,
          sourceLocationSheetAssetId: input.sourceLocationSheetAssetId,
        }).asset
      : null;
    return {
      purpose: LOCATION_HERO_GENERATION_PURPOSE,
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
      activeLookbook: requireActiveLookbookContext(session),
      environmentSheetTakes: assets.environmentSheetTakes,
      sourceLocationSheetAsset,
      imageFiles: locationImageFileReferences(projectFolder, [
        ...assets.environmentSheetTakes,
        ...(sourceLocationSheetAsset ? [sourceLocationSheetAsset] : []),
        ...assets.heroTakes,
        ...assets.selectedHeroes,
      ]),
      defaults: {
        takeCount: 1,
        seed: null,
        heroFrame: '16:9',
        detail: 'standard',
        outputFormat: 'png',
      },
      resourceKeys: studioResourceKeysForAssetTarget({
        kind: 'location',
        locationId: input.locationId,
      }),
    };
  });
}

export async function listLocationHeroModels(
  input: LocationHeroTargetInput
): Promise<LocationHeroModelListReport> {
  const context = await buildLocationHeroContext(input);
  return {
    purpose: LOCATION_HERO_GENERATION_PURPOSE,
    target: context.target,
    models: modelChoices(context),
  };
}

export async function validateLocationHeroSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LocationHeroGenerationSpec;
}): Promise<{
  valid: true;
  spec: LocationHeroGenerationSpec;
  providerPayload: Record<string, unknown>;
}> {
  const normalized = await normalizeSpec(input);
  const context = await buildLocationHeroContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: normalized.target.id,
    sourceLocationSheetAssetId: normalized.sourceLocationSheetAssetId,
  });
  const plan = buildLocationHeroProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createLocationHeroSpec(
  input: LocationHeroSpecFileInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withLocationProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized, 'Location hero image'),
      now: new Date().toISOString(),
    });
  });
}

export async function updateLocationHeroSpec(
  input: UpdateLocationHeroSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withLocationProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized, 'Location hero image'),
      now: new Date().toISOString(),
    })
  );
}

export async function readLocationHeroSpec(
  input: LocationHeroSpecIdInput
): Promise<MediaGenerationSpecRecord> {
  return withLocationProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listLocationHeroSpecs(
  input: LocationHeroTargetInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withLocationProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: LOCATION_HERO_GENERATION_PURPOSE,
      targetKind: 'location',
      targetId: input.locationId,
    }),
  }));
}

export async function prepareLocationHeroSpec(
  input: LocationHeroSpecIdInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readLocationHeroSpec(input);
  assertLocationHeroSpec(specRecord.spec);
  const context = await buildLocationHeroContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: specRecord.spec.target.id,
    sourceLocationSheetAssetId: specRecord.spec.sourceLocationSheetAssetId,
  });
  const plan = buildLocationHeroProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function buildLocationHeroGenerationPreview(
  input: LocationHeroSpecIdInput
) {
  const specRecord = await readLocationHeroSpec(input);
  assertLocationHeroSpec(specRecord.spec);
  const context = await buildLocationHeroContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: specRecord.spec.target.id,
    sourceLocationSheetAssetId: specRecord.spec.sourceLocationSheetAssetId,
  });
  const plan = buildLocationHeroProviderPayload(specRecord.spec, context);
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: LOCATION_HERO_GENERATION_PURPOSE,
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
    prompt: providerPreviewPromptText(plan.payload, specRecord.spec.prompt),
    references: locationHeroPreviewReferences(specRecord.spec, context),
    payload: plan.payload,
  });
}

export async function prepareLocationHeroDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LocationHeroGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const context = await buildLocationHeroContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: normalized.target.id,
    sourceLocationSheetAssetId: normalized.sourceLocationSheetAssetId,
  });
  const plan = buildLocationHeroProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

function locationHeroPreviewReferences(
  spec: LocationHeroGenerationSpec,
  context: LocationHeroGenerationContext
): GenerationPreviewRequestReference[] {
  const file = context.imageFiles.find(
    (candidate) =>
      candidate.assetId === spec.sourceLocationSheetAssetId &&
      candidate.role === 'primary'
  );
  if (!file) {
    return [];
  }
  return [
    {
      kind: 'image',
      role: 'location-environment-sheet',
      label: 'Location environment sheet',
      providerToken: 'image_urls',
      assetId: file.assetId,
      assetFileId: file.assetFileId,
      sourcePurpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
      selected: true,
    },
  ];
}

export async function runLocationHeroSpec(
  input: RunLocationHeroSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareLocationHeroSpec(input);
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
  return recordLocationHeroRun({
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

export async function generateLocationHeroFromSheet(
  input: GenerateLocationHeroFromSheetInput
): Promise<LocationHeroMutationReport> {
  const context = await buildLocationHeroContext(input);
  const sourceSheet = context.sourceLocationSheetAsset;
  if (!sourceSheet) {
    throw new ProjectDataError(
      'PROJECT_DATA316',
      `Location Hero source sheet is not attached to Location ${input.locationId}: ${input.sourceLocationSheetAssetId}.`
    );
  }
  const spec = await createLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    idGenerator: input.idGenerator,
    spec: specForSourceSheet(context, sourceSheet),
  });
  const runReport = await runLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: spec.id,
    approvalToken: input.approvalToken,
    simulate: input.simulate,
    approveUnpricedCost: input.approveUnpricedCost,
    idGenerator: input.idGenerator,
  });
  const output = firstImageOutput(runReport.run.outputs);
  const importReport = await importLocationHeroMedia({
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: input.locationId,
    sourceLocationSheetAssetId: input.sourceLocationSheetAssetId,
    sourceProjectRelativePath: output.projectRelativePath,
    title: titleForSpec(spec.spec as LocationHeroGenerationSpec, 'Location hero image'),
    description: (spec.spec as LocationHeroGenerationSpec).description,
    receipt: {
      mediaGenerationRunId: runReport.run.id,
      provider: runReport.run.provider,
      model: runReport.run.model,
      simulated: runReport.run.simulated,
    },
    idGenerator: input.idGenerator,
  });
  const assets = await withLocationProjectSession(input, ({ session }) =>
    listAssetRelationshipPage(session, {
      target: { kind: 'location', locationId: input.locationId },
      limit: 200,
    }).items
  );
  return { spec, run: runReport.run, importReport, assets };
}

export async function recordLocationHeroRun(
  input: RecordLocationHeroRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readLocationHeroSpec(input);
  assertLocationHeroSpec(specRecord.spec);
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

export async function importLocationHeroMedia(
  input: ImportLocationHeroMediaInput
): Promise<LocationHeroMediaImportReport> {
  return withLocationProjectSession(input, async ({ session, projectFolder, project }) => {
    const location = requireLocationForContext(session, input.locationId);
    requireSourceLocationSheetAsset(session, {
      locationId: input.locationId,
      sourceLocationSheetAssetId: input.sourceLocationSheetAssetId,
    });
    const sourceProjectRelativePath = normalizeProjectRelativePath(
      input.sourceProjectRelativePath
    );
    await validateImportSourceFile(projectFolder, sourceProjectRelativePath);
    const description = requiredTrimmed(input.description, 'Location hero description');
    const now = new Date().toISOString();
    const destinationFolder = await allocateLocationHeroFolder({
      projectFolder,
      locationHandle: location.handle,
      title: input.title ?? path.parse(sourceProjectRelativePath).name,
    });
    const importedFile = await copyLocationHeroFile({
      projectFolder,
      sourceProjectRelativePath,
      destinationFolder,
    });
    const imported = await insertImportedLocationHero({
      session,
      locationId: input.locationId,
      destinationFolder,
      file: importedFile,
      title: input.title,
      description,
      origin: input.receipt ? 'generated' : inferImportOrigin(sourceProjectRelativePath),
      idGenerator: input.idGenerator,
      now,
    });
    const target = { kind: 'location' as const, locationId: input.locationId };
    const asset = readAssetRelationship(session, { target, assetId: imported.assetId });
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
      project: { id: project.id, name: project.name, projectFolder },
      changes: [{ type: 'location.heroImported', locationId: input.locationId }],
      purpose: LOCATION_HERO_GENERATION_PURPOSE,
      target: { kind: 'location', id: input.locationId },
      imported: asset,
      sourceLocationSheetAssetId: input.sourceLocationSheetAssetId,
      files: [{ role: 'primary', projectRelativePath: importedFile.projectRelativePath }],
      resourceKeys,
    };
  });
}

export function buildLocationHeroProviderPayload(
  spec: LocationHeroGenerationSpec,
  context: LocationHeroGenerationContext
): LocationHeroProviderPlan {
  const sourcePath = resolveSourcePath(spec, context);
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2/edit':
      return buildGptImage2EditPayload(spec, sourcePath);
    case 'fal-ai/nano-banana-2/edit':
      return buildNanoBanana2EditPayload(spec, sourcePath);
    case 'fal-ai/xai/grok-imagine-image/edit':
      return buildGrokImagineEditPayload(spec, sourcePath);
    default:
      throw unsupportedModel(spec.modelChoice);
  }
}

async function normalizeSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: LocationHeroGenerationSpec;
}): Promise<LocationHeroGenerationSpec> {
  if (input.spec.purpose !== LOCATION_HERO_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA263',
      `Unsupported generation purpose: ${input.spec.purpose}.`
    );
  }
  assertAllowedSpecFields(input.spec);
  validateLocationTarget(input.spec.target);
  assertModelChoice(input.spec.modelChoice);
  const sourceLocationSheetAssetId = requiredTrimmed(
    input.spec.sourceLocationSheetAssetId,
    'sourceLocationSheetAssetId'
  );
  const prompt = requiredTrimmed(input.spec.prompt, 'Location hero prompt');
  const description = requiredTrimmed(
    input.spec.description,
    'Location hero description'
  );
  const takeCount = input.spec.takeCount ?? 1;
  if (takeCount !== 1) {
    throw new ProjectDataError(
      'PROJECT_DATA302',
      'Location hero takeCount must be exactly 1.'
    );
  }
  const seed = input.spec.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new ProjectDataError(
      'PROJECT_DATA303',
      'Location hero seed must be a non-negative integer or null.'
    );
  }
  const heroFrame = input.spec.heroFrame ?? '16:9';
  if (heroFrame !== '16:9') {
    throw new ProjectDataError(
      'PROJECT_DATA304',
      `Unsupported location hero frame: ${heroFrame}.`
    );
  }
  const detail = input.spec.detail ?? 'standard';
  if (detail !== 'draft' && detail !== 'standard' && detail !== 'high') {
    throw new ProjectDataError(
      'PROJECT_DATA305',
      `Unsupported location hero detail: ${detail}.`
    );
  }
  const outputFormat = input.spec.outputFormat ?? 'png';
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    throw new ProjectDataError(
      'PROJECT_DATA306',
      `Unsupported location hero output format: ${outputFormat}.`
    );
  }
  await withLocationProjectSession(input, ({ session }) => {
    requireLocationForContext(session, input.spec.target.id);
    requireSourceLocationSheetAsset(session, {
      locationId: input.spec.target.id,
      sourceLocationSheetAssetId,
    });
    requireActiveLookbookContext(session);
  });
  return {
    ...input.spec,
    sourceLocationSheetAssetId,
    prompt,
    takeCount: 1,
    seed,
    heroFrame,
    detail,
    outputFormat,
    description,
  };
}

function assertAllowedSpecFields(spec: LocationHeroGenerationSpec): void {
  const record = spec as unknown as Record<string, unknown>;
  const allowed = new Set([
    'purpose',
    'target',
    'sourceLocationSheetAssetId',
    'modelChoice',
    'prompt',
    'takeCount',
    'seed',
    'heroFrame',
    'detail',
    'outputFormat',
    'title',
    'description',
  ]);
  const unexpected = Object.keys(record).filter((field) => !allowed.has(field));
  if (unexpected.length) {
    throw new ProjectDataError(
      'PROJECT_DATA307',
      `Location hero spec contains unsupported fields: ${unexpected.join(', ')}.`
    );
  }
}

function buildGptImage2EditPayload(
  spec: LocationHeroGenerationSpec,
  sourcePath: string
): LocationHeroProviderPlan {
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('GPT Image 2 edit does not support generation seed.');
  }
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2/edit',
    mode: 'image-edit',
    outputCount: 1,
    inputFiles: sourceInputFiles(sourcePath),
    payload: {
      prompt: spec.prompt,
      image_urls: sourceLogicalInput(sourcePath),
      num_images: 1,
      image_size: 'landscape_16_9',
      quality: mapGptQuality(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function buildNanoBanana2EditPayload(
  spec: LocationHeroGenerationSpec,
  sourcePath: string
): LocationHeroProviderPlan {
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2/edit',
    mode: 'image-edit',
    outputCount: 1,
    inputFiles: sourceInputFiles(sourcePath),
    payload: {
      prompt: spec.prompt,
      image_urls: sourceLogicalInput(sourcePath),
      num_images: 1,
      seed: spec.seed ?? null,
      aspect_ratio: '16:9',
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
  spec: LocationHeroGenerationSpec,
  sourcePath: string
): LocationHeroProviderPlan {
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('Grok Imagine edit does not support generation seed.');
  }
  if ((spec.detail ?? 'standard') !== 'standard') {
    unsupported('Grok Imagine supports only standard detail.');
  }
  return {
    provider: 'fal-ai',
    model: 'xai/grok-imagine-image/edit',
    mode: 'image-edit',
    outputCount: 1,
    inputFiles: sourceInputFiles(sourcePath),
    payload: {
      prompt: spec.prompt,
      image_urls: sourceLogicalInput(sourcePath),
      num_images: 1,
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function specForSourceSheet(
  context: LocationHeroGenerationContext,
  sourceSheet: Asset
): LocationHeroGenerationSpec {
  const locationName = context.location.name.trim() || 'Location';
  const sheetDescription = sourceSheet.oneLineSummary?.trim();
  const title = `${locationName} hero image`;
  const description = sheetDescription
    ? `${locationName} representative hero image derived from ${sheetDescription}`
    : `${locationName} representative hero image derived from the selected Location Sheet.`;
  const promptParts = [
    `Create a clean 16:9 representative Location Hero Image for ${locationName}.`,
    'Use the supplied Location Sheet as the source of environment identity, materials, lighting, period detail, mood, and spatial continuity.',
    'Do not make a multi-panel sheet, contact sheet, labels, captions, diagrams, borders, or production annotations.',
    'Compose one cinematic, readable wide image suitable for a location overview card and detail header.',
  ];
  if (sheetDescription) {
    promptParts.push(`Source Location Sheet description: ${sheetDescription}.`);
  }
  if (context.location.description) {
    promptParts.push(`Location description: ${context.location.description}.`);
  }
  if (context.location.visualNotes) {
    promptParts.push(`Location visual notes: ${context.location.visualNotes}.`);
  }
  return {
    purpose: LOCATION_HERO_GENERATION_PURPOSE,
    target: context.target,
    sourceLocationSheetAssetId: sourceSheet.assetId,
    modelChoice: 'fal-ai/nano-banana-2/edit',
    prompt: promptParts.join(' '),
    takeCount: 1,
    seed: null,
    heroFrame: '16:9',
    detail: 'standard',
    outputFormat: 'png',
    title,
    description,
  };
}

function toGenerationRequest(
  plan: LocationHeroProviderPlan,
  spec: LocationHeroGenerationSpec
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
      inputFiles: plan.inputFiles,
      parameters,
      outputNames: [
        `${slugify(titleForSpec(spec, 'Location hero image'))}${extensionForOutputFormat(spec.outputFormat ?? 'png')}`,
      ],
    },
  };
}

function modelChoices(
  context: LocationHeroGenerationContext
): LocationHeroModelChoiceReport[] {
  const hasSource = Boolean(context.sourceLocationSheetAsset);
  const sourceUnavailable = hasSource
    ? {}
    : { unavailableReason: 'Choose a source Location Sheet before generating a Location Hero Image.' };
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2/edit',
      label: 'GPT Image 2 Edit',
      available: hasSource,
      supportsSeed: false,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedHeroFrames: ['16:9'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
      ...sourceUnavailable,
    },
    {
      modelChoice: 'fal-ai/nano-banana-2/edit',
      label: 'Nano Banana 2 Edit',
      available: hasSource,
      supportsSeed: true,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedHeroFrames: ['16:9'],
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
      ...sourceUnavailable,
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
      label: 'Grok Imagine Edit',
      available: hasSource,
      supportsSeed: false,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedHeroFrames: ['16:9'],
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
      ...sourceUnavailable,
    },
  ];
}

async function withLocationProjectSession<T>(
  input: LocationHeroProjectInput,
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

async function readLocationProjectContext(input: LocationHeroProjectInput) {
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

function buildLocationScreenplayContext(session: DatabaseSession) {
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

function requireLocationForContext(session: DatabaseSession, locationId: string) {
  const row = readLocationRecord(session, locationId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA311',
      `Location hero generation requires a screenplay location, but the requested location was not found: ${locationId}.`
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
      'Location hero generation requires a selected Movie Lookbook.',
      {
        suggestion:
          'Create or select a Movie Lookbook before generating location hero images.',
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
  environmentSheetTakes: Asset[];
  heroTakes: Asset[];
  selectedHeroes: Asset[];
} {
  const target = { kind: 'location' as const, locationId };
  return {
    environmentSheetTakes: listAssetRelationshipPage(session, {
      target,
      role: 'environment_sheet',
      selection: 'take',
      limit: 200,
    }).items,
    heroTakes: listAssetRelationshipPage(session, {
      target,
      role: 'hero',
      selection: 'take',
      limit: 200,
    }).items,
    selectedHeroes: listAssetRelationshipPage(session, {
      target,
      role: 'hero',
      selection: 'select',
      limit: 200,
    }).items,
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
        absolutePath: resolveProjectRelativePath(projectFolder, file.projectRelativePath),
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
      });
    }
  }
  return references;
}

function requireSourceLocationSheetAsset(
  session: DatabaseSession,
  input: { locationId: string; sourceLocationSheetAssetId: string }
): { asset: Asset; projectRelativePath: ProjectRelativePath } {
  const target = { kind: 'location' as const, locationId: input.locationId };
  const asset = readAssetRelationship(session, {
    target,
    assetId: input.sourceLocationSheetAssetId,
  });
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA316',
      `Location Hero source sheet is not attached to Location ${input.locationId}: ${input.sourceLocationSheetAssetId}.`
    );
  }
  if (asset.role !== 'environment_sheet') {
    throw new ProjectDataError(
      'PROJECT_DATA317',
      `Location Hero source asset must use location asset role "environment_sheet". Received: ${asset.role}.`
    );
  }
  if (asset.type !== 'location_environment_sheet' || asset.mediaKind !== 'image') {
    throw new ProjectDataError(
      'PROJECT_DATA318',
      `Location Hero source asset must be a Location Sheet image: ${input.sourceLocationSheetAssetId}.`
    );
  }
  const file = asset.files.find(
    (candidate) => candidate.role === 'primary' && candidate.mediaKind === 'image'
  );
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA319',
      `Location Hero source sheet has no primary image file: ${input.sourceLocationSheetAssetId}.`
    );
  }
  return { asset, projectRelativePath: file.projectRelativePath };
}

function resolveSourcePath(
  spec: LocationHeroGenerationSpec,
  context: LocationHeroGenerationContext
): string {
  const file = context.imageFiles.find(
    (candidate) =>
      candidate.assetId === spec.sourceLocationSheetAssetId &&
      candidate.role === 'primary'
  );
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA319',
      `Location Hero source sheet has no primary image file: ${spec.sourceLocationSheetAssetId}.`
    );
  }
  return file.projectRelativePath;
}

function validateLocationTarget(target: LocationHeroGenerationSpec['target']): void {
  if (target.kind !== 'location') {
    throw new ProjectDataError(
      'PROJECT_DATA313',
      `Location hero generation requires target.kind "location". Received: ${target.kind}.`
    );
  }
}

function assertModelChoice(modelChoice: string): asserts modelChoice is LocationHeroModelChoice {
  if (!LOCATION_HERO_MODELS.has(modelChoice)) {
    throw unsupportedModel(modelChoice);
  }
}

function unsupportedModel(modelChoice: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA314',
    `Unsupported Location hero model: ${modelChoice}.`
  );
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}

function assertLocationHeroSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is LocationHeroGenerationSpec {
  if (spec.purpose !== LOCATION_HERO_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
}

async function resolveLocationGenerationOutputPaths(input: LocationHeroProjectInput) {
  return withLocationProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
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

async function copyLocationHeroFile(input: {
  projectFolder: string;
  sourceProjectRelativePath: ProjectRelativePath;
  destinationFolder: ProjectRelativePath;
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
  const destinationProjectRelativePath = joinProjectRelativePath(
    input.destinationFolder,
    `hero${extensionForSource(input.sourceProjectRelativePath)}`
  );
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }
  const stats = await statExistingFile(destinationPath);
  return {
    projectRelativePath: destinationProjectRelativePath,
    mimeType: mimeTypeForPath(destinationProjectRelativePath),
    sizeBytes: stats.size,
    contentHash: await hashFile(destinationPath),
  };
}

async function insertImportedLocationHero(input: {
  session: DatabaseSession;
  locationId: string;
  destinationFolder: ProjectRelativePath;
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
      type: 'location_hero',
      mediaKind: 'image',
      title: input.title?.trim() || path.basename(input.destinationFolder),
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
    for (const hero of listAssetRelationshipPage(txSession, {
      target,
      role: 'hero',
      selection: 'select',
      limit: 200,
    }).items) {
      updateAssetRelationshipSelection(txSession, {
        target,
        assetId: hero.assetId,
        selection: 'take',
        selectionOrder: null,
        updatedAt: input.now,
      });
    }
    insertAssetRelationshipRecord(txSession, target, {
      relationshipId: ids('location_asset'),
      assetId,
      localeId: null,
      role: 'hero',
      sortOrder: nextAssetRelationshipSortOrder(txSession, {
        target,
        role: 'hero',
        localeId: null,
      }),
      now: input.now,
    });
    updateAssetRelationshipSelection(txSession, {
      target,
      assetId,
      selection: 'select',
      selectionOrder: 1,
      updatedAt: input.now,
    });
  });
  return { assetId };
}

async function allocateLocationHeroFolder(input: {
  projectFolder: string;
  locationHandle: string;
  title: string;
}): Promise<ProjectRelativePath> {
  const parent = joinProjectRelativePath(LOCATIONS_ROOT, input.locationHandle, 'heroes');
  const base = slugify(input.title) || 'hero';
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      parent,
      index === 0 ? base : `${base}-${index + 1}`
    );
    try {
      await fs.access(resolveProjectRelativePath(input.projectFolder, candidate));
    } catch {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA315',
    `Could not allocate a unique location hero folder for ${input.title}.`
  );
}

function sourceInputFiles(
  sourcePath: string
): PreparedMediaGeneration['generation']['request']['inputFiles'] {
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

function sourceLogicalInput(sourcePath: string): string[] {
  return [`renku-input://${encodeURI(sourcePath)}`];
}

function inferImportOrigin(sourceProjectRelativePath: ProjectRelativePath): string {
  return sourceProjectRelativePath.startsWith('generated/media/')
    ? 'generated'
    : 'imported';
}

function titleForSpec(spec: LocationHeroGenerationSpec, fallback: string): string {
  return spec.title?.trim() || spec.prompt.trim().slice(0, 80) || fallback;
}

function firstImageOutput(outputs: MediaGenerationRun['outputs']): {
  projectRelativePath: ProjectRelativePath;
  mimeType?: string | null;
} {
  const candidates = Array.isArray(outputs)
    ? outputs
    : typeof outputs === 'object' && outputs !== null
      ? Object.values(outputs)
      : [];
  const output = candidates.find(isImageOutput) as
    | { projectRelativePath: ProjectRelativePath; mimeType?: string | null }
    | undefined;
  if (!output) {
    throw new ProjectDataError(
      'PROJECT_DATA308',
      'Location hero generation did not produce an image output.',
      {
        suggestion:
          'Run the Location Hero generation again and confirm the provider returned an image file.',
      }
    );
  }
  return output;
}

function isImageOutput(output: unknown): output is {
  projectRelativePath: ProjectRelativePath;
  mimeType?: string | null;
} {
  if (!output || typeof output !== 'object') {
    return false;
  }
  const record = output as {
    projectRelativePath?: unknown;
    mimeType?: unknown;
  };
  return (
    typeof record.projectRelativePath === 'string' &&
    /\.(jpe?g|png|webp)$/i.test(record.projectRelativePath) &&
    (record.mimeType === undefined ||
      record.mimeType === null ||
      typeof record.mimeType === 'string')
  );
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
  return slug || 'location-hero';
}

function extensionForOutputFormat(format: LocationHeroOutputFormat): string {
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
    `Location hero import file must be a png, jpg, jpeg, or webp image: ${filePath}.`
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
