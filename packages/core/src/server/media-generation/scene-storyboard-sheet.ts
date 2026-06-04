import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  MediaGenerationEstimateReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
  SceneStoryboardSheetGenerationContext,
  SceneStoryboardSheetGenerationSpec,
  SceneStoryboardSheetImportReport,
  SceneStoryboardSheetModelChoice,
  SceneStoryboardSheetModelChoiceReport,
  SceneStoryboardSheetModelListReport,
  SceneStoryboardSheetOutputFormat,
} from '../../client/index.js';
import {
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
} from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import {
  assertShotIdsExistInShotList,
  insertSceneShotStoryboardImageRecord,
  insertSceneShotStoryboardSheetRecord,
  readSceneShotListDocument,
  requireSceneShotListForScene,
} from '../database/access/scene-shot-lists.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../database/access/media-generation.js';
import {
  readActiveLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../database/access/lookbook.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { readProjectRecord, type ProjectRecord } from '../database/access/project.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ImportSceneStoryboardSheetMediaInput,
  ReadSceneStoryboardSheetGenerationContextInput,
  ReadMediaGenerationSpecInput,
  RecordMediaGenerationRunInput,
  RunMediaGenerationSpecInput,
  ValidateSceneStoryboardSheetGenerationSpecInput,
} from '../project-data-service-contracts.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { sceneShotListResourceKeys } from '../commands/scene-shot-list-commands.js';
import type { SceneShot } from '../../client/scene-shot-list.js';
import { LOCATION_AZIMUTH_VIEW_LABELS } from '../../client/shot-spec-labels.js';
import {
  mapGptQuality,
  mapNanoBananaResolution,
  mapPresetFrame,
  resolveCastImageFrame,
  CAST_IMAGE_FRAMES,
} from './cast-image-common.js';
import { draftMediaGenerationSpecRecord } from './draft-generation.js';

const STORYBOARD_SHEET_MODELS = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

const OUTPUT_FORMATS = new Set<SceneStoryboardSheetOutputFormat>([
  'png',
  'jpeg',
  'webp',
]);

interface SceneStoryboardSheetProviderPlan {
  provider: 'fal-ai';
  model: string;
  mode: 'text-to-image';
  payload: Record<string, unknown>;
  outputCount: 1;
}

export async function buildSceneStoryboardSheetContext(
  input: ReadSceneStoryboardSheetGenerationContextInput
): Promise<SceneStoryboardSheetGenerationContext> {
  return withSceneProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const hierarchy = requireSceneHierarchy(screenplay, input.sceneId);
    const shotListRow = requireSceneShotListForScene({
      session,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
    });
    const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
    const projectInfo = readProjectInformationResourceFromDatabase(session);
    const references = collectShotListReferences(shotList, screenplay);
    const activeLookbook = readActiveLookbookContext(session);
    return {
      purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
      target: { kind: 'scene', id: input.sceneId },
      shotListId: input.shotListId,
      project: {
        id: project.id,
        name: project.name,
        projectFolder,
        title: projectInfo.title,
        aspectRatio: projectInfo.aspectRatio ?? '16:9',
      },
      screenplay: {
        title: screenplay.screenplay.title,
        logline: screenplay.screenplay.logline,
        summary: screenplay.screenplay.summary,
        genrePrimary: screenplay.screenplay.genrePrimary,
        genreSecondary: screenplay.screenplay.genreSecondary,
        tone: screenplay.screenplay.tone,
        themes: screenplay.screenplay.themes,
      },
      act: {
        id: hierarchy.act.id as string,
        title: hierarchy.act.title,
        purpose: hierarchy.act.purpose,
      },
      sequence: {
        id: hierarchy.sequence.id as string,
        title: hierarchy.sequence.title,
        purpose: hierarchy.sequence.purpose,
      },
      scene: {
        id: hierarchy.scene.id as string,
        title: hierarchy.scene.title,
        setting: hierarchy.scene.setting,
        storyFunction: hierarchy.scene.storyFunction ?? [],
        blocks: hierarchy.scene.blocks,
      },
      cast: references.cast,
      locations: references.locations,
      activeLookbook,
      shotList,
      shotListSummary: {
        id: shotListRow.id,
        sceneId: shotListRow.sceneId,
        title: shotList.title,
        summary: shotList.summary,
        createdAt: shotListRow.createdAt,
        updatedAt: shotListRow.updatedAt,
        isActive: true,
      },
      defaults: {
        takeCount: 1,
        seed: null,
        sheetFrame: '4:3',
        shotFrame: 'project',
        resolvedShotFrame: projectInfo.aspectRatio ?? '16:9',
        detail: 'standard',
        outputFormat: 'png',
        maxShotsPerSheet: 4,
      },
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: input.shotListId,
      }),
    };
  });
}

export async function listSceneStoryboardSheetModels(
  input: ReadSceneStoryboardSheetGenerationContextInput
): Promise<SceneStoryboardSheetModelListReport> {
  await buildSceneStoryboardSheetContext(input);
  return {
    purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
    target: { kind: 'scene', id: input.sceneId },
    shotListId: input.shotListId,
    models: modelChoices(),
  };
}

export async function validateSceneStoryboardSheetSpec(
  input: ValidateSceneStoryboardSheetGenerationSpecInput
): Promise<{
  valid: true;
  spec: SceneStoryboardSheetGenerationSpec;
  providerPayload: Record<string, unknown>;
}> {
  const normalized = await normalizeSpec(input);
  const context = await buildSceneStoryboardSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: normalized.target.id,
    shotListId: normalized.shotListId,
  });
  const plan = buildSceneStoryboardSheetProviderPayload(normalized, context);
  return { valid: true, spec: normalized, providerPayload: plan.payload };
}

export async function createSceneStoryboardSheetSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: SceneStoryboardSheetGenerationSpec;
  idGenerator?: ProjectIdGenerator;
}): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateSceneStoryboardSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withSceneProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForSpec(normalized, 'Scene storyboard sheet'),
      now: new Date().toISOString(),
    });
  });
}

export async function updateSceneStoryboardSheetSpec(input: {
  projectName?: string;
  homeDir?: string;
  specId: string;
  spec: SceneStoryboardSheetGenerationSpec;
}): Promise<MediaGenerationSpecRecord> {
  const normalized = await normalizeSpec(input);
  await validateSceneStoryboardSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: normalized,
  });
  return withSceneProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForSpec(normalized, 'Scene storyboard sheet'),
      now: new Date().toISOString(),
    })
  );
}

export async function readSceneStoryboardSheetSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withSceneProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export async function listSceneStoryboardSheetSpecs(
  input: ReadSceneStoryboardSheetGenerationContextInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  return withSceneProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
      targetKind: 'scene',
      targetId: input.sceneId,
    }),
  }));
}

export async function prepareSceneStoryboardSheetSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readSceneStoryboardSheetSpec(input);
  assertSceneStoryboardSheetSpec(specRecord.spec);
  const context = await buildSceneStoryboardSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: specRecord.spec.target.id,
    shotListId: specRecord.spec.shotListId,
  });
  const plan = buildSceneStoryboardSheetProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function prepareSceneStoryboardSheetDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: SceneStoryboardSheetGenerationSpec;
}): Promise<PreparedMediaGeneration> {
  const normalized = await normalizeSpec(input);
  const context = await buildSceneStoryboardSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: normalized.target.id,
    shotListId: normalized.shotListId,
  });
  const plan = buildSceneStoryboardSheetProviderPayload(normalized, context);
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

export async function estimateSceneStoryboardSheetSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareSceneStoryboardSheetSpec(input);
  const { estimateGeneration } = await loadGenerationEngines();
  const estimate = await estimateGeneration(prepared.generation);
  if (estimate.estimatedCostUsd === null) {
    throw new ProjectDataError(
      'PROJECT_DATA333',
      'Generation estimate is unknown for the selected Scene storyboard sheet model.'
    );
  }
  return { ...prepared, estimate };
}

export async function runSceneStoryboardSheetSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareSceneStoryboardSheetSpec(input);
  const { estimateGeneration, runGeneration } = await loadGenerationEngines();
  const estimate = await estimateGeneration(prepared.generation);
  if (estimate.estimatedCostUsd === null) {
    throw new ProjectDataError(
      'PROJECT_DATA333',
      'Generation estimate is unknown for the selected Scene storyboard sheet model.'
    );
  }
  const outputPaths = await resolveSceneGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  return recordSceneStoryboardSheetRun({
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

export async function recordSceneStoryboardSheetRun(
  input: RecordMediaGenerationRunInput
): Promise<MediaGenerationRunReport> {
  const specRecord = await readSceneStoryboardSheetSpec(input);
  assertSceneStoryboardSheetSpec(specRecord.spec);
  const now = new Date().toISOString();
  const run = await withSceneProjectSession(input, ({ session }) => {
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

export async function importSceneStoryboardSheetMedia(
  input: ImportSceneStoryboardSheetMediaInput
): Promise<SceneStoryboardSheetImportReport> {
  return withSceneProjectSession(input, async ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const shotListRow = requireSceneShotListForScene({
      session,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
    });
    const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
    const normalized = normalizeImportDocument(input.document);
    const normalizedShots = normalized.sheets.flatMap((sheet) => sheet.shots);
    assertShotIdsExistInShotList({
      shotList,
      shotIds: normalizedShots.map((shot) => shot.shotId),
    });
    validateImportSelectedShots(normalized.sheets);
    await validateImportSourceFiles(projectFolder, [
      ...normalized.sheets.flatMap((sheet) => [
        sheet.source,
        ...sheet.shots.map((shot) => shot.source),
      ]),
    ]);
    const now = new Date().toISOString();
    const destinationFolder = await allocateSceneStoryboardFolder({
      projectFolder,
      sceneTitle: requireSceneHierarchy(screenplay, input.sceneId).scene.title,
      title:
        input.title ??
        normalized.title ??
        normalized.sheets[0]?.title ??
        'Scene storyboard sheet',
    });
    const copied = await copySceneStoryboardFiles({
      projectFolder,
      document: normalized,
      destinationFolder,
      shotList,
    });
    const imported = await insertImportedSceneStoryboardSheet({
      session,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      destinationFolder,
      files: copied,
      title: input.title ?? normalized.title ?? normalized.sheets[0]?.title,
      origin: inferImportOrigin([
        ...normalized.sheets.flatMap((sheet) => [
          sheet.source,
          ...sheet.shots.map((shot) => shot.source),
        ]),
      ]),
      idGenerator: input.idGenerator,
      now,
    });
    const target = { kind: 'scene' as const, sceneId: input.sceneId };
    const asset = readAssetRelationship(session, {
      target,
      assetId: imported.assetId,
    });
    if (!asset) {
      throw new ProjectDataError(
        'PROJECT_DATA334',
        `Asset ${imported.assetId} is not attached to the requested scene.`
      );
    }
    return {
      valid: true,
      warnings: [],
      project: {
        id: project.id,
        name: project.name,
        projectFolder,
      },
      changes: [
        {
          type: 'scene.storyboardSheetImported',
          sceneId: input.sceneId,
          shotListId: input.shotListId,
        },
      ],
      purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
      target: { kind: 'scene', id: input.sceneId },
      shotListId: input.shotListId,
      storyboardSheetId: imported.storyboardSheetIds[0] ?? '',
      storyboardSheetIds: imported.storyboardSheetIds,
      imported: asset,
      files: copied.map((file) => ({
        role: file.role,
        ...(file.shotId ? { shotId: file.shotId } : {}),
        ...(file.sheetIndex ? { sheetIndex: file.sheetIndex } : {}),
        projectRelativePath: file.projectRelativePath,
      })),
      resourceKeys: sceneShotListResourceKeys({
        sceneId: input.sceneId,
        shotListId: input.shotListId,
        storyboardSheetIds: imported.storyboardSheetIds,
        shotIds: normalizedShots.map((shot) => shot.shotId),
      }),
    };
  });
}

export function buildSceneStoryboardSheetProviderPayload(
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
): SceneStoryboardSheetProviderPlan {
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
  spec: SceneStoryboardSheetGenerationSpec;
}): Promise<SceneStoryboardSheetGenerationSpec> {
  if (input.spec.purpose !== SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA329',
      `Unsupported generation purpose: ${input.spec.purpose}.`
    );
  }
  rejectRemovedSpecFields(input.spec);
  validateSceneTarget(input.spec.target);
  assertModelChoice(input.spec.modelChoice);
  if (input.spec.prompt.trim().length === 0) {
    throw new ProjectDataError(
      'PROJECT_DATA330',
      'Scene storyboard sheet prompt cannot be empty.'
    );
  }
  const takeCount = input.spec.takeCount ?? 1;
  if (takeCount !== 1) {
    throw new ProjectDataError(
      'PROJECT_DATA332',
      'Scene storyboard sheet takeCount must be exactly 1.'
    );
  }
  const seed = input.spec.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new ProjectDataError(
      'PROJECT_DATA303',
      'Scene storyboard sheet seed must be a non-negative integer or null.'
    );
  }
  const sheetFrame = input.spec.sheetFrame ?? '4:3';
  if (sheetFrame !== '4:3') {
    throw new ProjectDataError(
      'PROJECT_DATA331',
      `Unsupported Scene storyboard sheet frame: ${sheetFrame}.`
    );
  }
  const shotFrame = input.spec.shotFrame ?? 'project';
  if (shotFrame !== 'project' && !CAST_IMAGE_FRAMES.has(shotFrame)) {
    throw new ProjectDataError(
      'PROJECT_DATA331',
      `Unsupported Scene storyboard sheet shot frame: ${shotFrame}.`
    );
  }
  const shotIds = normalizeShotIds(input.spec.shotIds);
  const detail = input.spec.detail ?? 'standard';
  if (detail !== 'draft' && detail !== 'standard' && detail !== 'high') {
    throw new ProjectDataError(
      'PROJECT_DATA305',
      `Unsupported Scene storyboard sheet detail: ${detail}.`
    );
  }
  const outputFormat = input.spec.outputFormat ?? 'png';
  if (!OUTPUT_FORMATS.has(outputFormat)) {
    throw new ProjectDataError(
      'PROJECT_DATA306',
      `Unsupported Scene storyboard sheet output format: ${outputFormat}.`
    );
  }
  await withSceneProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const row = requireSceneShotListForScene({
      session,
      sceneId: input.spec.target.id,
      shotListId: input.spec.shotListId,
    });
    const shotList = readSceneShotListDocument({ row, screenplay });
    assertShotIdsExistInShotList({ shotList, shotIds });
  });
  return {
    ...input.spec,
    prompt: input.spec.prompt.trim(),
    takeCount: 1,
    seed,
    sheetFrame,
    shotFrame,
    shotIds,
    detail,
    outputFormat,
  };
}

function rejectRemovedSpecFields(spec: SceneStoryboardSheetGenerationSpec): void {
  const record = spec as unknown as Record<string, unknown>;
  const removedFields = ['imageFrame', 'visualizationStyle'];
  const present = removedFields.find((field) => record[field] !== undefined);
  if (present) {
    throw new ProjectDataError(
      'PROJECT_DATA344',
      `Scene storyboard sheet specs no longer support ${present}. Use sheetFrame and shotFrame.`
    );
  }
}

function normalizeShotIds(shotIds: unknown): string[] {
  if (!Array.isArray(shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA345',
      'Scene storyboard sheet specs require shotIds.'
    );
  }
  if (shotIds.length < 1 || shotIds.length > 4) {
    throw new ProjectDataError(
      'PROJECT_DATA345',
      'Scene storyboard sheet specs must include one to four shotIds.'
    );
  }
  const normalized = shotIds.map((shotId) => {
    if (typeof shotId !== 'string' || shotId.trim().length === 0) {
      throw new ProjectDataError(
        'PROJECT_DATA345',
        'Scene storyboard sheet shotIds must be non-empty strings.'
      );
    }
    return shotId.trim();
  });
  const seen = new Set<string>();
  for (const shotId of normalized) {
    if (seen.has(shotId)) {
      throw new ProjectDataError(
        'PROJECT_DATA336',
        `Scene storyboard sheet spec repeats shot id: ${shotId}.`
      );
    }
    seen.add(shotId);
  }
  return normalized;
}

function buildGptImage2Payload(
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
): SceneStoryboardSheetProviderPlan {
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('GPT Image 2 does not support generation seed.');
  }
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2',
    mode: 'text-to-image',
    outputCount: 1,
    payload: {
      prompt: buildProviderPrompt(spec, context),
      num_images: 1,
      image_size: mapPresetFrame(resolvedSheetFrame(spec)),
      quality: mapGptQuality(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function buildNanoBanana2Payload(
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
): SceneStoryboardSheetProviderPlan {
  return {
    provider: 'fal-ai',
    model: 'nano-banana-2',
    mode: 'text-to-image',
    outputCount: 1,
    payload: {
      prompt: buildProviderPrompt(spec, context),
      num_images: 1,
      seed: spec.seed ?? null,
      aspect_ratio: resolvedSheetFrame(spec),
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
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
): SceneStoryboardSheetProviderPlan {
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
      prompt: buildProviderPrompt(spec, context),
      num_images: 1,
      aspect_ratio: resolvedSheetFrame(spec),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function toGenerationRequest(
  plan: SceneStoryboardSheetProviderPlan,
  spec: SceneStoryboardSheetGenerationSpec
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
        `${slugify(titleForSpec(spec, 'Scene storyboard sheet'))}${extensionForOutputFormat(spec.outputFormat ?? 'png')}`,
      ],
    },
  };
}

function modelChoices(): SceneStoryboardSheetModelChoiceReport[] {
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: true,
      supportsSeed: false,
      takeCount: { min: 1, max: 1, default: 1 },
      supportedSheetFrames: ['4:3'],
      supportedShotFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16'],
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
      supportedShotFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16', '21:9'],
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
      supportedShotFrames: ['project', '1:1', '3:4', '4:3', '16:9', '9:16', '21:9'],
      supportedDetails: ['standard'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
    },
  ];
}

async function withSceneProjectSession<T>(
  input: RenkuConfigPathOptions & { projectName?: string },
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

function requireScreenplayDocument(session: DatabaseSession) {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Use `renku screenplay create` first.',
    });
  }
  return screenplay;
}

function requireSceneHierarchy(
  screenplay: ReturnType<typeof requireScreenplayDocument>,
  sceneId: string
) {
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return { act, sequence, scene };
        }
      }
    }
  }
  throw new ProjectDataError('PROJECT_DATA326', `Scene was not found: ${sceneId}.`);
}

function collectShotListReferences(
  shotList: ReturnType<typeof readSceneShotListDocument>,
  screenplay: ReturnType<typeof requireScreenplayDocument>
): {
  cast: SceneStoryboardSheetGenerationContext['cast'];
  locations: SceneStoryboardSheetGenerationContext['locations'];
} {
  const castMemberIds = new Set(
    shotList.shots.flatMap((shot) => shot.castMemberIds)
  );
  const locationIds = new Set(
    shotList.shots.flatMap((shot) => effectiveShotLocationIds(shot))
  );
  return {
    cast: screenplay.cast
      .filter((castMember) => castMember.id && castMemberIds.has(castMember.id))
      .map((castMember) => ({
        id: castMember.id as string,
        handle: castMember.handle,
        name: castMember.name,
        role: castMember.role,
        description: castMember.description,
      })),
    locations: screenplay.locations
      .filter((location) => location.id && locationIds.has(location.id))
      .map((location) => ({
        id: location.id as string,
        handle: location.handle,
        name: location.name,
        timePeriod: location.timePeriod,
        description: location.description,
        visualNotes: location.visualNotes,
      })),
  };
}

function readActiveLookbookContext(
  session: DatabaseSession
): SceneStoryboardSheetGenerationContext['activeLookbook'] {
  const activeLookbookId = readActiveLookbookId(session);
  if (!activeLookbookId) {
    return null;
  }
  const lookbook = toLookbook(requireLookbookRecordById(session, activeLookbookId));
  return {
    id: lookbook.id,
    name: lookbook.name,
    thesis: JSON.stringify(lookbook.thesis),
    palette: JSON.stringify(lookbook.palette),
    camera: JSON.stringify(lookbook.camera),
    toneMood: JSON.stringify(lookbook.toneMood),
    texture: JSON.stringify(lookbook.texture),
    composition: JSON.stringify(lookbook.composition),
    lighting: JSON.stringify(lookbook.lighting),
  };
}

function validateSceneTarget(
  target: SceneStoryboardSheetGenerationSpec['target']
): void {
  if (target.kind !== 'scene') {
    throw new ProjectDataError(
      'PROJECT_DATA329',
      `Scene storyboard sheet generation requires target.kind "scene". Received: ${target.kind}.`
    );
  }
}

function assertModelChoice(
  modelChoice: string
): asserts modelChoice is SceneStoryboardSheetModelChoice {
  if (!STORYBOARD_SHEET_MODELS.has(modelChoice)) {
    throw unsupportedModel(modelChoice);
  }
}

function unsupportedModel(modelChoice: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA314',
    `Unsupported Scene storyboard sheet model: ${modelChoice}.`
  );
}

function unsupported(message: string): never {
  throw new ProjectDataError('PROJECT_DATA272', message);
}

function assertSceneStoryboardSheetSpec(
  spec: MediaGenerationSpecRecord['spec']
): asserts spec is SceneStoryboardSheetGenerationSpec {
  if (spec.purpose !== SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${spec.purpose}.`
    );
  }
  rejectRemovedSpecFields(spec);
  normalizeShotIds((spec as unknown as Record<string, unknown>).shotIds);
}

function resolvedSheetFrame(
  spec: SceneStoryboardSheetGenerationSpec
): '4:3' {
  return spec.sheetFrame ?? '4:3';
}

function resolvedShotFrame(
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
) {
  return resolveCastImageFrame(
    { imageFrame: spec.shotFrame ?? 'project' },
    context.project.aspectRatio
  );
}

function buildProviderPrompt(
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
): string {
  const selectedShots = selectedShotsForSpec(spec, context);
  const selectedCastIds = new Set(
    selectedShots.flatMap((shot) => shot.castMemberIds)
  );
  const selectedLocationIds = new Set(
    selectedShots.flatMap((shot) => effectiveShotLocationIds(shot))
  );
  const locationsById = new Map(
    context.locations.map((location) => [location.id, location])
  );
  const shotFrame = resolvedShotFrame(spec, context);
  return [
    spec.prompt,
    '',
    `Create one ${resolvedSheetFrame(spec)} storyboard sheet as a single finished image.`,
    `Arrange ${selectedShots.length} clean ${shotFrame} ${orientationForFrame(shotFrame)} storyboard panel${selectedShots.length === 1 ? '' : 's'} in shot-list order.`,
    `Each panel is a clean ${shotFrame} ${orientationForFrame(shotFrame)} storyboard frame.`,
    'Use hand-drawn graphite pencil and light ink on warm off-white paper, with subtle gray/beige washes, visible sketch construction, readable staging, and production-board clarity.',
    'Use rounded white panel cards with dark gutters or a considered dark presentation surround.',
    'Render storyboard drawings, not photoreal final film stills, heavy charcoal/noir contrast, or cinematic black-and-white grading.',
    'Keep labels in the margin or sheet header; do not place labels, debug marks, crop marks, or decorative text inside the shot image content.',
    '',
    'Selected shots:',
    ...selectedShots.map((shot, index) =>
      [
        `${index + 1}. ${shot.shotId}: ${shot.title}`,
        `subject: ${shot.subject}`,
        `location: ${shotLocationPromptText(shot, locationsById)}`,
        `framing: ${shot.framing ?? shot.shotType}`,
        `camera angle: ${shot.cameraAngle ?? 'not specified'}`,
        `lens intent: ${shot.lensIntent ?? 'not specified'}`,
        `movement: ${shot.cameraMovement ?? 'not specified'}`,
        `story purpose: ${shot.narrativePurpose}`,
        `action: ${shot.action}`,
      ].join(' | ')
    ),
    selectedCastIds.size
      ? `Referenced cast: ${context.cast
          .filter((castMember) => selectedCastIds.has(castMember.id))
          .map((castMember) => `${castMember.name} (${castMember.id})`)
          .join(', ')}`
      : 'Referenced cast: none specified for these shots.',
    selectedLocationIds.size
      ? `Referenced locations: ${context.locations
          .filter((location) => selectedLocationIds.has(location.id))
          .map((location) => `${location.name} (${location.id})`)
          .join(', ')}`
      : 'Referenced locations: none specified for these shots.',
    context.activeLookbook
      ? `Active Lookbook notes: palette ${context.activeLookbook.palette}; texture ${context.activeLookbook.texture}; lighting ${context.activeLookbook.lighting}; composition ${context.activeLookbook.composition}.`
      : 'Active Lookbook notes: none available.',
  ].join('\n');
}

function selectedShotsForSpec(
  spec: SceneStoryboardSheetGenerationSpec,
  context: SceneStoryboardSheetGenerationContext
) {
  const selectedIds = new Set(spec.shotIds);
  const validShotIds = new Set(
    context.shotList.shots.map((shot) => shot.shotId)
  );
  const missing = spec.shotIds.find((shotId) => !validShotIds.has(shotId));
  if (missing) {
    throw new ProjectDataError(
      'PROJECT_DATA325',
      `Storyboard generation references a shot id that is not in the Scene Shot List: ${missing}.`
    );
  }
  return context.shotList.shots.filter((shot) => selectedIds.has(shot.shotId));
}

function effectiveShotLocationIds(shot: SceneShot): string[] {
  const selectedLocationId = shot.shotSpecs?.location?.locationId;
  return selectedLocationId ? [selectedLocationId] : shot.locationIds;
}

function shotLocationPromptText(
  shot: SceneShot,
  locationsById: Map<
    string,
    SceneStoryboardSheetGenerationContext['locations'][number]
  >
): string {
  const locationIds = effectiveShotLocationIds(shot);
  if (!locationIds.length) {
    return 'not specified';
  }

  const locationText = locationIds
    .map((locationId) => {
      const location = locationsById.get(locationId);
      return location ? `${location.name} (${location.id})` : locationId;
    })
    .join(', ');
  const viewText = shotLocationViewPromptText(shot);
  return viewText ? `${locationText}; view: ${viewText}` : locationText;
}

function shotLocationViewPromptText(shot: SceneShot): string | null {
  const location = shot.shotSpecs?.location;
  if (location?.azimuthView) {
    return LOCATION_AZIMUTH_VIEW_LABELS[location.azimuthView];
  }
  return null;
}

function orientationForFrame(frame: string): string {
  const [width, height] = frame.split(':').map((value) => Number(value));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width === height) {
    return 'square';
  }
  return width > height ? 'landscape' : 'portrait';
}

async function resolveSceneGenerationOutputPaths(
  input: RenkuConfigPathOptions & { projectName?: string }
) {
  return withSceneProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}

function normalizeImportDocument(
  document: ImportSceneStoryboardSheetMediaInput['document']
) {
  if (document.kind !== 'sceneStoryboardSheetImport') {
    throw new ProjectDataError(
      'PROJECT_DATA335',
      'Storyboard sheet import document kind must be sceneStoryboardSheetImport.'
    );
  }
  const sheets = (document as unknown as { sheets?: typeof document.sheets })
    .sheets;
  if (!Array.isArray(sheets)) {
    throw new ProjectDataError(
      'PROJECT_DATA335',
      'Storyboard sheet import document must include sheets[].'
    );
  }
  return {
    title: document.title,
    sheets: sheets.map((sheet) => ({
      source: normalizeProjectRelativePath(sheet.source),
      title: sheet.title,
      shots: sheet.shots.map((shot) => ({
        shotId: shot.shotId,
        source: normalizeProjectRelativePath(shot.source),
        title: shot.title,
      })),
    })),
  };
}

function validateImportSelectedShots(
  sheets: Array<{
    source: ProjectRelativePath;
    shots: Array<{ shotId: string; source: ProjectRelativePath }>;
  }>
): void {
  if (sheets.length === 0) {
    throw new ProjectDataError(
      'PROJECT_DATA337',
      'Storyboard sheet import requires at least one sheet.'
    );
  }
  const sourcesByShotId = new Map<string, ProjectRelativePath>();
  for (const [sheetIndex, sheet] of sheets.entries()) {
    if (sheet.shots.length === 0) {
      throw new ProjectDataError(
        'PROJECT_DATA337',
        `Storyboard sheet import sheet ${sheetIndex + 1} requires at least one cropped shot image.`
      );
    }
    for (const shot of sheet.shots) {
      if (sourcesByShotId.has(shot.shotId)) {
        throw new ProjectDataError(
          'PROJECT_DATA336',
          `Storyboard sheet import repeats shot id: ${shot.shotId}.`
        );
      }
      sourcesByShotId.set(shot.shotId, shot.source);
    }
  }
}

async function validateImportSourceFiles(
  projectFolder: string,
  files: ProjectRelativePath[]
): Promise<void> {
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file)) {
      throw new ProjectDataError(
        'PROJECT_DATA338',
        `Storyboard sheet import reuses a source file: ${file}.`
      );
    }
    seen.add(file);
    const sourcePath = resolveProjectRelativePath(projectFolder, file);
    assertResolvedPathInsideProject(projectFolder, sourcePath);
    await statExistingFile(sourcePath);
    if (!isImagePath(file)) {
      throw new ProjectDataError(
        'PROJECT_DATA339',
        `Storyboard sheet import file must be an image: ${file}.`
      );
    }
  }
}

async function copySceneStoryboardFiles(input: {
  projectFolder: string;
  document: ReturnType<typeof normalizeImportDocument>;
  destinationFolder: ProjectRelativePath;
  shotList: ReturnType<typeof readSceneShotListDocument>;
}): Promise<
  Array<{
    role: 'sheet' | 'shot';
    sheetIndex?: number;
    shotId?: string;
    projectRelativePath: ProjectRelativePath;
    mimeType: string;
    sizeBytes: number;
    contentHash: string;
  }>
> {
  const copied = [];
  const selectedShotIds = new Set(
    input.document.sheets.flatMap((sheet) =>
      sheet.shots.map((shot) => shot.shotId)
    )
  );
  const shotPositions = new Map(
    input.shotList.shots
      .filter((shot) => selectedShotIds.has(shot.shotId))
      .map((shot, index) => [shot.shotId, index + 1])
  );
  for (const [sheetIndex, sheet] of input.document.sheets.entries()) {
    copied.push(
      await copyStoryboardFile({
        projectFolder: input.projectFolder,
        source: sheet.source,
        destination: joinProjectRelativePath(
          input.destinationFolder,
          sheetFileName(sheet.source, sheetIndex, input.document.sheets.length)
        ),
        role: 'sheet',
        sheetIndex: sheetIndex + 1,
      })
    );
    for (const shot of sheet.shots) {
      const position = shotPositions.get(shot.shotId);
      if (!position) {
        throw new ProjectDataError(
          'PROJECT_DATA337',
          `Storyboard sheet import is missing a shot-list position for shot id: ${shot.shotId}.`
        );
      }
      copied.push(
        await copyStoryboardFile({
          projectFolder: input.projectFolder,
          source: shot.source,
          destination: joinProjectRelativePath(
            input.destinationFolder,
            `shot-${String(position).padStart(2, '0')}${extensionForSource(shot.source)}`
          ),
          role: 'shot',
          sheetIndex: sheetIndex + 1,
          shotId: shot.shotId,
        })
      );
    }
  }
  return copied;
}

function sheetFileName(
  source: ProjectRelativePath,
  sheetIndex: number,
  sheetCount: number
): string {
  const extension = extensionForSource(source);
  return sheetCount === 1
    ? `sheet${extension}`
    : `sheet-${String(sheetIndex + 1).padStart(2, '0')}${extension}`;
}

async function copyStoryboardFile(input: {
  projectFolder: string;
  source: ProjectRelativePath;
  destination: ProjectRelativePath;
  role: 'sheet' | 'shot';
  sheetIndex?: number;
  shotId?: string;
}) {
  const sourcePath = resolveProjectRelativePath(input.projectFolder, input.source);
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    input.destination
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }
  const stats = await statExistingFile(destinationPath);
  return {
    role: input.role,
    ...(input.sheetIndex ? { sheetIndex: input.sheetIndex } : {}),
    ...(input.shotId ? { shotId: input.shotId } : {}),
    projectRelativePath: input.destination,
    mimeType: mimeTypeForPath(input.destination),
    sizeBytes: stats.size,
    contentHash: await hashFile(destinationPath),
  };
}

async function insertImportedSceneStoryboardSheet(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
  destinationFolder: ProjectRelativePath;
  files: Awaited<ReturnType<typeof copySceneStoryboardFiles>>;
  title?: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const assetId = ids('asset');
  const storyboardSheetIds: string[] = [];
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    insertAssetRecord(txSession, {
      id: assetId,
      type: 'scene_storyboard_sheet',
      mediaKind: 'image',
      title: input.title?.trim() || path.basename(input.destinationFolder),
      origin: input.origin,
      availability: 'ready',
      createdAt: input.now,
      updatedAt: input.now,
    });
    const assetFileIds = new Map<string, string>();
    for (const file of input.files) {
      const assetFileId = ids('asset_file');
      assetFileIds.set(importedFileKey(file), assetFileId);
      insertAssetFileRecord(txSession, {
        id: assetFileId,
        assetId,
        role: file.role,
        projectRelativePath: file.projectRelativePath,
        mediaKind: 'image',
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        contentHash: file.contentHash,
        createdAt: input.now,
        updatedAt: input.now,
      });
    }
    const sheetFiles = input.files.filter((file) => file.role === 'sheet');
    for (const sheetFile of sheetFiles) {
      if (!sheetFile.sheetIndex) {
        throw new ProjectDataError(
          'PROJECT_DATA340',
          'Storyboard sheet file is missing its sheet index.'
        );
      }
      const sheet = insertSceneShotStoryboardSheetRecord(txSession, {
        id: ids('scene_shot_storyboard_sheet'),
        shotListId: input.shotListId,
        assetId,
        sheetFileId: requireImportedFileId(
          assetFileIds,
          importedFileKey(sheetFile)
        ),
        now: input.now,
      });
      storyboardSheetIds.push(sheet.id);
      const shotFiles = input.files.filter(
        (file) => file.role === 'shot' && file.sheetIndex === sheetFile.sheetIndex
      );
      shotFiles.forEach((file, index) => {
        if (!file.shotId) {
          throw new ProjectDataError(
            'PROJECT_DATA340',
            'Storyboard shot file is missing its shot id.'
          );
        }
        insertSceneShotStoryboardImageRecord(txSession, {
          id: ids('scene_shot_storyboard_image'),
          storyboardSheetId: sheet.id,
          shotId: file.shotId,
          assetFileId: requireImportedFileId(assetFileIds, importedFileKey(file)),
          position: index + 1,
          now: input.now,
        });
      });
    }
    const target = { kind: 'scene' as const, sceneId: input.sceneId };
    insertAssetRelationshipRecord(txSession, target, {
      relationshipId: ids('scene_asset'),
      assetId,
      localeId: null,
      role: 'storyboard_sheet',
      sortOrder: nextAssetRelationshipSortOrder(txSession, {
        target,
        role: 'storyboard_sheet',
        localeId: null,
      }),
      now: input.now,
    });
  });
  return { assetId, storyboardSheetIds };
}

function requireImportedFileId(
  fileIdsByRole: Map<string, string>,
  key: string
): string {
  const assetFileId = fileIdsByRole.get(key);
  if (!assetFileId) {
    throw new ProjectDataError(
      'PROJECT_DATA340',
      `Storyboard sheet import did not create a file for ${key}.`
    );
  }
  return assetFileId;
}

function importedFileKey(input: {
  role: 'sheet' | 'shot';
  sheetIndex?: number;
  shotId?: string;
}): string {
  if (input.role === 'sheet') {
    return `sheet:${input.sheetIndex ?? 1}`;
  }
  return `shot:${input.shotId ?? ''}`;
}

async function allocateSceneStoryboardFolder(input: {
  projectFolder: string;
  sceneTitle: string;
  title: string;
}): Promise<ProjectRelativePath> {
  const parent = joinProjectRelativePath(
    'screenplay',
    'storyboards',
    slugify(input.sceneTitle) || 'scene'
  );
  const base = slugify(input.title) || 'storyboard-sheet';
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
    'PROJECT_DATA341',
    `Could not allocate a storyboard folder for ${input.title}.`
  );
}

function titleForSpec(
  spec: SceneStoryboardSheetGenerationSpec,
  fallback: string
): string {
  return spec.title?.trim() || fallback;
}

function extensionForOutputFormat(
  outputFormat: SceneStoryboardSheetOutputFormat
): string {
  return outputFormat === 'jpeg' ? '.jpg' : `.${outputFormat}`;
}

function extensionForSource(source: ProjectRelativePath): string {
  const extension = path.extname(source).toLowerCase();
  return extension || '.png';
}

function isImagePath(filePath: ProjectRelativePath): boolean {
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(
    path.extname(filePath).toLowerCase()
  );
}

function mimeTypeForPath(filePath: ProjectRelativePath): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}

async function statExistingFile(filePath: string): Promise<{
  size: number;
  isFile(): boolean;
}> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA342',
      `Storyboard sheet import source file was not found: ${filePath}.`
    );
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  resolvedPath: string
): void {
  const relative = path.relative(projectFolder, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA343',
      `Path must stay inside the project folder: ${resolvedPath}.`
    );
  }
}

function inferImportOrigin(files: ProjectRelativePath[]): string {
  return files.some((file) => file.startsWith('generated/media/'))
    ? 'generated'
    : 'imported';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function loadGenerationEngines() {
  return await import('@gorenku/studio-engines');
}
