import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  CastCharacterSheetGenerationContext,
  CastCharacterSheetReferenceOption,
  CastCharacterSheetReferenceSelections,
  CastCharacterSheetGenerationSpec,
  CastImageDetail,
  CastCharacterSheetModelChoice,
  CastCharacterSheetModelListReport,
  CastImageModelChoiceReport,
  CastMediaImportReport,
  GenerationReferenceFileInput,
  GenerationPreviewRequest,
  MediaGenerationDependencySlot,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
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
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import { studioResourceKeysForAssetTarget } from '../../studio-coordination/resource-keys.js';
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
import {
  castCharacterSheetDependencyId,
  castReferenceImageDependencyId,
} from '../dependencies/dependency-identifiers.js';
import {
  castCharacterSheetDependencySlot,
  castReferenceImageDependencySlot,
} from '../dependencies/dependency-slot-definitions.js';
import type { MediaGenerationDependencyDeclarationInput } from '../lifecycle/purpose-lifecycle-registry.js';
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
import { buildSavedImageGenerationPreview } from '../../generation-preview/saved-image-preview.js';
import { providerPreviewPromptText } from '../../generation-preview/provider-preview-prompt.js';

const CHARACTER_SHEET_MODELS = new Set<string>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

const GROK_IMAGINE_MAX_REFERENCE_IMAGES = 3;

interface CastCharacterSheetReferenceContext {
  castMember: CastCharacterSheetGenerationContext['castMember'];
  selectedAssets: Asset[];
  characterSheetTakes: Asset[];
  referenceImageAssets: Asset[];
}

interface CastCharacterSheetProviderReference {
  referenceRole: string;
  label: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image';
}

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

export interface UpdateCastCharacterSheetReferenceInclusionInput extends CastCharacterSheetSpecIdInput {
  dependencyId: string;
  inclusion: 'include' | 'exclude' | null;
}

export interface RunCastCharacterSheetSpecInput extends CastCharacterSheetSpecIdInput {
  approvalToken?: string;
  simulate?: boolean;
  approveUnpricedCost?: boolean;
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
    const activeLookbook = readActiveLookbookContext(session);
    const activeCastDesign = readActiveCastDesignDocument(session, input.castMemberId);
    const assets = readCastAssetsByRole(session, input.castMemberId);
    const imageFiles = imageFileReferences(projectFolder, [
      ...assets.selectedAssets,
      ...assets.characterSheetTakes,
      ...assets.profileTakes,
      ...assets.referenceImageAssets,
    ]);
    const contextWithoutOptions = {
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
      referenceImageAssets: assets.referenceImageAssets,
      imageFiles,
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
    } satisfies Omit<CastCharacterSheetGenerationContext, 'referenceOptions'>;
    return {
      ...contextWithoutOptions,
      referenceOptions: resolveCastCharacterSheetReferenceOptions({
        context: contextWithoutOptions,
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

export async function declareCastCharacterSheetDependencies(
  input: MediaGenerationDependencyDeclarationInput
): Promise<MediaGenerationDependencySlot[]> {
  if (input.target.kind !== 'castMember') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `cast.character-sheet dependency planning requires a castMember target. Received: ${input.target.kind}.`
    );
  }
  const context = await buildCastCharacterSheetReferenceContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: input.target.id,
  });
  return resolveCastCharacterSheetReferenceOptions({
    context,
    referenceSelections: referenceSelectionsFromDependencyRequest(input.request),
  }).map((option) => {
    const asset = findCastReferenceAsset(context, option.assetId);
    const slot =
      option.dependencyKind === 'cast-character-sheet'
        ? castCharacterSheetDependencySlot({
            castMemberId: context.castMember.id,
            castMemberName: context.castMember.name,
            assetId: option.assetId,
            selectionPolicy: 'selected-only',
            required: option.required,
            reason: 'Optional continuity reference for the cast character sheet.',
          })
        : castReferenceImageDependencySlot({
            castMemberId: context.castMember.id,
            castMemberName: context.castMember.name,
            assetId: option.assetId,
            assetTitle: asset?.title,
            required: option.required,
            reason: 'Optional ad hoc visual reference for the cast character sheet.',
          });
    return {
      ...slot,
      label: option.label,
      defaultIncluded: option.defaultIncluded,
    };
  });
}

async function buildCastCharacterSheetReferenceContext(
  input: CastCharacterSheetTargetInput
): Promise<CastCharacterSheetReferenceContext> {
  return withCastProjectSession(input, ({ session }) => {
    const castMember = requireCastMemberForContext(session, input.castMemberId);
    const assets = readCastAssetsByRole(session, input.castMemberId);
    return {
      castMember,
      selectedAssets: assets.selectedAssets,
      characterSheetTakes: assets.characterSheetTakes,
      referenceImageAssets: assets.referenceImageAssets,
    };
  });
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
  resolveCastCharacterSheetReferenceOptions({
    context,
    referenceSelections: normalized.referenceSelections,
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

export async function buildCastCharacterSheetGenerationPreview(
  input: {
    projectName?: string;
    homeDir?: string;
    specRecord: MediaGenerationSpecRecord;
  }
): Promise<GenerationPreviewRequest> {
  const { specRecord } = input;
  assertCharacterSheetSpec(specRecord.spec);
  const context = await buildCastCharacterSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: specRecord.spec.target.id,
  });
  const referenceOptions = resolveCastCharacterSheetReferenceOptions({
    context,
    referenceSelections: specRecord.spec.referenceSelections,
  });
  const plan = buildCastCharacterSheetProviderPayload(specRecord.spec, context);
  return buildSavedImageGenerationPreview({
    specRecord,
    purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
    project: context.project,
    target: specRecord.target,
    title: specRecord.title,
    modelChoice: specRecord.spec.modelChoice,
    modelLabel: castCharacterSheetModelLabel(specRecord.spec.modelChoice, context),
    provider: plan.provider,
    providerModel: plan.model,
    mode: plan.mode,
    prompt: providerPreviewPromptText(plan.payload, specRecord.spec.prompt),
    references: referenceOptions.map((reference) => ({
      kind: 'image' as const,
      role: reference.referenceRole,
      label: reference.label,
      providerToken: 'image_urls',
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
      sourcePurpose:
        reference.dependencyKind === 'cast-character-sheet'
          ? CAST_CHARACTER_SHEET_GENERATION_PURPOSE
          : undefined,
      selected: reference.included,
      selectionControl: {
        dependencyId: reference.dependencyId,
        required: reference.required,
        defaultIncluded: reference.defaultIncluded,
        inclusionOverride: reference.inclusionOverride,
        editable: true,
      },
    })),
    providerTokenOrder: referenceOptions
      .filter((reference) => reference.included)
      .map((reference) => reference.dependencyId)
      .concat(
        (specRecord.spec.referenceFiles ?? []).map(
          (referenceFile) => referenceFile.projectRelativePath
        )
      ),
    payload: plan.payload,
  });
}

export async function updateCastCharacterSheetReferenceInclusion(
  input: UpdateCastCharacterSheetReferenceInclusionInput
): Promise<GenerationPreviewRequest> {
  const specRecord = await readCastCharacterSheetSpec(input);
  assertCharacterSheetSpec(specRecord.spec);
  const context = await buildCastCharacterSheetContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: specRecord.spec.target.id,
  });
  const referenceOptions = resolveCastCharacterSheetReferenceOptions({
    context,
    referenceSelections: specRecord.spec.referenceSelections,
  });
  if (!referenceOptions.some((option) => option.dependencyId === input.dependencyId)) {
    throw new ProjectDataError(
      'PROJECT_DATA294',
      `Cast character sheet reference dependency was not found: ${input.dependencyId}.`,
      {
        suggestion:
          'Refresh the generation preview and choose one of the displayed reference dependencies.',
      }
    );
  }
  const nextInclusions = {
    ...(specRecord.spec.referenceSelections?.dependencyInclusions ?? {}),
  };
  if (input.inclusion === null) {
    delete nextInclusions[input.dependencyId];
  } else {
    nextInclusions[input.dependencyId] = input.inclusion;
  }
  const nextReferenceSelections =
    Object.keys(nextInclusions).length > 0
      ? { dependencyInclusions: nextInclusions }
      : undefined;
  const nextSpec = {
    ...specRecord.spec,
    ...(nextReferenceSelections
      ? { referenceSelections: nextReferenceSelections }
      : {}),
  };
  if (!nextReferenceSelections) {
    delete (nextSpec as { referenceSelections?: unknown }).referenceSelections;
  }
  const updatedSpecRecord = await updateCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: nextSpec,
  });
  return buildCastCharacterSheetGenerationPreview({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specRecord: updatedSpecRecord,
  });
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
        'Translate the project visual language and cast design into visible identity, wardrobe, material, palette, lighting, posture, and turnaround-layout instructions. Keep the sheet useful as a video reference image.',
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

export async function runCastCharacterSheetSpec(
  input: RunCastCharacterSheetSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareCastCharacterSheetSpec(input);
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
  const outputPaths = await resolveCastGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode,
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
    estimate: mediaGenerationEstimateWithApproval(estimate, costApproval),
    approvalToken: mediaGenerationRunApprovalToken(costApproval),
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
  const references = includedCastCharacterSheetReferences(spec, context);
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return buildGptImage2Payload(spec, context, references);
    case 'fal-ai/nano-banana-2':
      return buildNanoBanana2Payload(spec, context, references);
    case 'fal-ai/xai/grok-imagine-image':
      return buildGrokImaginePayload(spec, context, references);
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
  const controls = normalizeCastImageSpecControls(input.spec, 'project');
  const referenceSelections = normalizeReferenceSelections(input.spec.referenceSelections);
  const referenceFiles = normalizeReferenceFiles(input.spec.referenceFiles);
  const normalized: CastCharacterSheetGenerationSpec = {
    ...controls,
    ...(referenceSelections ? { referenceSelections } : {}),
    ...(referenceFiles ? { referenceFiles } : {}),
  };
  await withCastProjectSession(input, async ({ session, projectFolder }) => {
    requireCastMemberForContext(session, normalized.target.id);
    await validateReferenceFiles(projectFolder, referenceFiles);
  });
  return normalized;
}

function buildGptImage2Payload(
  spec: CastCharacterSheetGenerationSpec,
  context: CastCharacterSheetGenerationContext,
  references: CastCharacterSheetProviderReference[]
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('GPT Image 2 does not support generation seed.');
  }
  if (references.length > 0) {
    return {
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      mode: 'reference-to-image',
      outputCount: takeCount,
      inputFiles: referenceInputFiles(references),
      payload: {
        prompt: spec.prompt,
        image_urls: referenceLogicalInputs(references),
        num_images: takeCount,
        image_size: mapPresetFrame(resolveCastImageFrame(spec, context.project.aspectRatio)),
        quality: mapGptQuality(spec.detail ?? 'standard'),
        output_format: spec.outputFormat ?? 'png',
        sync_mode: false,
      },
    };
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
  context: CastCharacterSheetGenerationContext,
  references: CastCharacterSheetProviderReference[]
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (references.length > 0) {
    return {
      provider: 'fal-ai',
      model: 'nano-banana-2/edit',
      mode: 'reference-to-image',
      outputCount: takeCount,
      inputFiles: referenceInputFiles(references),
      payload: {
        prompt: spec.prompt,
        image_urls: referenceLogicalInputs(references),
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
  context: CastCharacterSheetGenerationContext,
  references: CastCharacterSheetProviderReference[]
): CastProviderPlan {
  const takeCount = requireTakeCount(spec, 4);
  if (spec.seed !== null && spec.seed !== undefined) {
    unsupported('Grok Imagine does not support generation seed.');
  }
  requireGrokImagineReferenceCount(references);
  const frame = resolveCastImageFrame(spec, context.project.aspectRatio);
  if (frame === '21:9') {
    unsupported('Grok Imagine does not support exact 21:9.');
  }
  if (references.length > 0) {
    return {
      provider: 'fal-ai',
      model: grokImagineEditModel(spec.detail ?? 'standard'),
      mode: 'reference-to-image',
      outputCount: takeCount,
      inputFiles: referenceInputFiles(references),
      payload: {
        prompt: spec.prompt,
        image_urls: referenceLogicalInputs(references),
        num_images: takeCount,
        aspect_ratio: frame,
        resolution: mapGrokImagineResolution(spec.detail ?? 'standard'),
        output_format: spec.outputFormat ?? 'png',
        sync_mode: false,
      },
    };
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
      resolution: mapGrokImagineResolution(spec.detail ?? 'standard'),
      output_format: spec.outputFormat ?? 'png',
      sync_mode: false,
    },
  };
}

function requireGrokImagineReferenceCount(
  references: CastCharacterSheetProviderReference[]
): void {
  if (references.length <= GROK_IMAGINE_MAX_REFERENCE_IMAGES) {
    return;
  }
  throw new ProjectDataError(
    'CORE_CAST_CHARACTER_SHEET_REFERENCE_LIMIT_EXCEEDED',
    `Grok Imagine supports at most ${GROK_IMAGINE_MAX_REFERENCE_IMAGES} reference images for cast character sheets, but ${references.length} were resolved.`,
    {
      suggestion:
        'Exclude some character sheet references, or use GPT Image 2 or Nano Banana 2 for larger reference sets.',
    }
  );
}

function grokImagineEditModel(detail: CastImageDetail): string {
  return detail === 'high'
    ? 'xai/grok-imagine-image/quality/edit'
    : 'xai/grok-imagine-image/edit';
}

function mapGrokImagineResolution(detail: CastImageDetail): '1k' | '2k' {
  return detail === 'high' ? '2k' : '1k';
}

function includedCastCharacterSheetReferences(
  spec: CastCharacterSheetGenerationSpec,
  context: CastCharacterSheetGenerationContext
): CastCharacterSheetProviderReference[] {
  const assetReferences = resolveCastCharacterSheetReferenceOptions({
    context,
    referenceSelections: spec.referenceSelections,
  }).filter((reference) => reference.included);
  return [
    ...assetReferences,
    ...referenceFileProviderReferences(spec.referenceFiles ?? []),
  ];
}

export function resolveCastCharacterSheetReferenceOptions(input: {
  context: CastCharacterSheetReferenceContext;
  referenceSelections?: CastCharacterSheetReferenceSelections;
}): CastCharacterSheetReferenceOption[] {
  const baseOptions = [
    ...referenceOptionsForAssets({
      context: input.context,
      assets: characterSheetReferenceAssets(input.context),
      dependencyKind: 'cast-character-sheet',
      referenceRole: 'character-sheet-continuity',
      defaultIncluded: true,
    }),
    ...referenceOptionsForAssets({
      context: input.context,
      assets: input.context.referenceImageAssets ?? [],
      dependencyKind: 'cast-reference-image',
      referenceRole: 'cast-reference-image',
      defaultIncluded: false,
    }),
  ];
  const byDependencyId = new Map(
    baseOptions.map((option) => [option.dependencyId, option])
  );
  const selections = input.referenceSelections?.dependencyInclusions ?? {};
  for (const dependencyId of Object.keys(selections)) {
    if (!byDependencyId.has(dependencyId)) {
      throw new ProjectDataError(
        'PROJECT_DATA294',
        `Cast character sheet reference dependency was not found: ${dependencyId}.`,
        {
          suggestion:
            'Refresh the generation context and choose one of the available reference dependencies.',
        }
      );
    }
  }
  return baseOptions.map((option) => {
    const inclusionOverride = selections[option.dependencyId] ?? null;
    return {
      ...option,
      inclusionOverride,
      included:
        option.required ||
        inclusionOverride === 'include' ||
        (inclusionOverride === null && option.defaultIncluded),
    };
  });
}

function referenceOptionsForAssets(input: {
  context: CastCharacterSheetReferenceContext;
  assets: Asset[];
  dependencyKind: 'cast-character-sheet' | 'cast-reference-image';
  referenceRole: CastCharacterSheetReferenceOption['referenceRole'];
  defaultIncluded: boolean;
}): CastCharacterSheetReferenceOption[] {
  const options: CastCharacterSheetReferenceOption[] = [];
  const seenAssetIds = new Set<string>();
  for (const asset of input.assets) {
    if (seenAssetIds.has(asset.assetId)) {
      continue;
    }
    seenAssetIds.add(asset.assetId);
    const file = primaryImageFile(asset);
    if (!file) {
      continue;
    }
    const dependencyId =
      input.dependencyKind === 'cast-character-sheet'
        ? castCharacterSheetDependencyId(input.context.castMember.id, asset.assetId)
        : castReferenceImageDependencyId(input.context.castMember.id, asset.assetId);
    options.push({
      dependencyId,
      dependencyKind: input.dependencyKind,
      referenceRole: input.referenceRole,
      label: assetReferenceLabel(asset),
      assetId: asset.assetId,
      assetFileId: file.id,
      projectRelativePath: file.projectRelativePath,
      mediaKind: 'image',
      required: false,
      defaultIncluded: input.defaultIncluded,
      inclusionOverride: null,
      included: input.defaultIncluded,
    });
  }
  return options;
}

function characterSheetReferenceAssets(input: {
  selectedAssets: Asset[];
  characterSheetTakes: Asset[];
}): Asset[] {
  return dedupeAssetsById([
    ...input.selectedAssets.filter(
      (asset) => asset.role === 'character_sheet' && asset.mediaKind === 'image'
    ),
    ...input.characterSheetTakes.filter((asset) => asset.mediaKind === 'image'),
  ]);
}

function dedupeAssetsById(assets: Asset[]): Asset[] {
  const seen = new Set<string>();
  const deduped: Asset[] = [];
  for (const asset of assets) {
    if (seen.has(asset.assetId)) {
      continue;
    }
    seen.add(asset.assetId);
    deduped.push(asset);
  }
  return deduped;
}

function primaryImageFile(asset: Asset): Asset['files'][number] | null {
  return (
    asset.files.find(
      (file) => file.mediaKind === 'image' && file.role === 'primary'
    ) ??
    asset.files.find((file) => file.mediaKind === 'image') ??
    null
  );
}

function assetReferenceLabel(asset: Asset): string {
  return asset.referenceName?.trim() || asset.title.trim() || asset.assetId;
}

function findCastReferenceAsset(
  context: CastCharacterSheetReferenceContext,
  assetId: string
): Asset | null {
  return (
    [
      ...context.selectedAssets,
      ...context.characterSheetTakes,
      ...context.referenceImageAssets,
    ].find((asset) => asset.assetId === assetId) ?? null
  );
}

function referenceFileProviderReferences(
  referenceFiles: GenerationReferenceFileInput[]
): CastCharacterSheetProviderReference[] {
  return referenceFiles.map((referenceFile) => ({
    referenceRole: referenceFile.role,
    label: referenceFile.label ?? referenceFile.role,
    projectRelativePath: referenceFile.projectRelativePath,
    mediaKind: 'image',
  }));
}

function referenceInputFiles(
  references: CastCharacterSheetProviderReference[]
): CastProviderPlan['inputFiles'] {
  return references.map((reference) => ({
    field: 'image_urls',
    projectRelativePath: reference.projectRelativePath,
    mediaKind: 'image' as const,
    asArray: true,
    required: false,
  }));
}

function referenceLogicalInputs(
  references: CastCharacterSheetProviderReference[]
): string[] {
  return references.map(
    (reference) => `renku-input://${encodeURI(reference.projectRelativePath)}`
  );
}

function normalizeReferenceFiles(
  value: CastCharacterSheetGenerationSpec['referenceFiles']
): GenerationReferenceFileInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new ProjectDataError(
      'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_INVALID',
      'Cast character sheet referenceFiles must be an array.'
    );
  }
  const normalized = value.map((referenceFile, index) => {
    if (!referenceFile || typeof referenceFile !== 'object' || Array.isArray(referenceFile)) {
      throw new ProjectDataError(
        'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_INVALID',
        `Cast character sheet referenceFiles[${index}] must be an object.`
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
        'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_UNSUPPORTED',
        `Cast character sheet referenceFiles[${index}] must use mediaKind "image". Received: ${String(candidate.mediaKind)}.`
      );
    }
    const role = typeof candidate.role === 'string' ? candidate.role.trim() : '';
    if (!role) {
      throw new ProjectDataError(
        'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_INVALID',
        `Cast character sheet referenceFiles[${index}].role must be a non-empty string.`
      );
    }
    if (typeof candidate.projectRelativePath !== 'string') {
      throw new ProjectDataError(
        'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_INVALID',
        `Cast character sheet referenceFiles[${index}].projectRelativePath must be a string.`
      );
    }
    const projectRelativePath = normalizeProjectRelativePath(
      candidate.projectRelativePath
    );
    if (
      candidate.label !== undefined &&
      typeof candidate.label !== 'string'
    ) {
      throw new ProjectDataError(
        'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_INVALID',
        `Cast character sheet referenceFiles[${index}].label must be a string when provided.`
      );
    }
    const label =
      typeof candidate.label === 'string' ? candidate.label.trim() : undefined;
    return {
      projectRelativePath,
      mediaKind: 'image' as const,
      role,
      ...(label ? { label } : {}),
    };
  });
  return normalized.length > 0 ? normalized : undefined;
}

async function validateReferenceFiles(
  projectFolder: string,
  referenceFiles: GenerationReferenceFileInput[] | undefined
): Promise<void> {
  for (const referenceFile of referenceFiles ?? []) {
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
        'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_NOT_FILE',
        `Cast character sheet reference file must be a file: ${projectRelativePath}.`
      );
    }
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_MISSING',
      `Cast character sheet reference file was not found: ${projectRelativePath}.`
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
      'CORE_CAST_CHARACTER_SHEET_REFERENCE_FILE_OUTSIDE_PROJECT',
      `Cast character sheet reference file must stay inside the project folder: ${resolvedPath}.`
    );
  }
}

function normalizeReferenceSelections(
  value: CastCharacterSheetGenerationSpec['referenceSelections']
): CastCharacterSheetReferenceSelections | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProjectDataError(
      'PROJECT_DATA294',
      'Cast character sheet referenceSelections must be an object.'
    );
  }
  const inclusions = value.dependencyInclusions;
  if (!inclusions || typeof inclusions !== 'object' || Array.isArray(inclusions)) {
    throw new ProjectDataError(
      'PROJECT_DATA294',
      'Cast character sheet referenceSelections.dependencyInclusions must be an object.'
    );
  }
  const normalized: Record<string, 'include' | 'exclude'> = {};
  for (const [dependencyId, inclusion] of Object.entries(inclusions)) {
    if (!dependencyId.trim()) {
      throw new ProjectDataError(
        'PROJECT_DATA294',
        'Cast character sheet reference dependency ids must be non-empty strings.'
      );
    }
    if (inclusion !== 'include' && inclusion !== 'exclude') {
      throw new ProjectDataError(
        'PROJECT_DATA294',
        `Unsupported cast character sheet reference inclusion: ${String(inclusion)}.`
      );
    }
    normalized[dependencyId] = inclusion;
  }
  return Object.keys(normalized).length > 0
    ? { dependencyInclusions: normalized }
    : undefined;
}

function referenceSelectionsFromDependencyRequest(
  request: { kind: string; [key: string]: unknown }
): CastCharacterSheetReferenceSelections | undefined {
  const spec = request.spec;
  if (
    request.kind !== 'media-generation-spec' ||
    !spec ||
    typeof spec !== 'object' ||
    Array.isArray(spec) ||
    (spec as { purpose?: unknown }).purpose !== CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  ) {
    return undefined;
  }
  return normalizeReferenceSelections(
    (spec as CastCharacterSheetGenerationSpec).referenceSelections
  );
}

function castCharacterSheetModelLabel(
  modelChoice: CastCharacterSheetModelChoice,
  context: CastCharacterSheetGenerationContext
): string {
  return (
    modelChoices(context).find((model) => model.modelChoice === modelChoice)?.label ??
    modelChoice
  );
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
      supportsImageReferences: true,
      maxImageReferences: null,
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
      supportsImageReferences: true,
      maxImageReferences: null,
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
      supportedDetails: ['draft', 'standard', 'high'],
      supportedOutputFormats: ['png', 'jpeg', 'webp'],
      supportsImageReferences: true,
      maxImageReferences: GROK_IMAGINE_MAX_REFERENCE_IMAGES,
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
