import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationEstimateReport,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
  SceneShot,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeAvailableInput,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeInputGenerationPurpose,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeIntentId,
  ShotVideoTakeMediaImportReport,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeModelListReport,
  ShotVideoTakePreflightDependency,
  ShotVideoTakePreflightInput,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionGroup,
  ShotVideoTakeProductionPlan,
  ShotVideoTakeRequestedInput,
} from '../../client/index.js';
import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../client/index.js';
import { insertAssetFileRecord, readAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  insertMediaGenerationRun,
  insertMediaGenerationSpec,
  listMediaGenerationSpecs,
  requireMediaGenerationSpec,
  updateMediaGenerationSpec,
} from '../database/access/media-generation.js';
import {
  readActiveSceneShotListId,
  readSceneShotListDocument,
  requireSceneShotListForScene,
  updateSceneShotListRecordDocument,
} from '../database/access/scene-shot-lists.js';
import {
  clearShotVideoTakeInputRecordSelection,
  insertShotVideoTakeInputRecord,
  insertShotVideoTakeRecord,
  listShotVideoTakeInputs as listShotVideoTakeInputRecords,
  listShotVideoTakes,
  requireShotVideoTakeInput,
  selectShotVideoTakeInputRecord,
} from '../database/access/shot-video-takes.js';
import { readActiveLookbookId, requireLookbookRecordById, toLookbook } from '../database/access/lookbook.js';
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
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ClearShotVideoTakeInputSelectionInput,
  CreateShotVideoTakeGenerationSpecInput,
  CreateShotVideoTakeInputGenerationSpecInput,
  ImportShotVideoTakeInputMediaInput,
  ImportShotVideoTakeMediaInput,
  PreviewShotVideoTakeProductionInput,
  ReadMediaGenerationSpecInput,
  RunMediaGenerationSpecInput,
  SelectShotVideoTakeInputInput,
  ShotVideoTakeContextInput,
  ShotVideoTakeModelListInput,
  UpdateShotVideoTakeGenerationSpecInput,
  UpdateShotVideoTakeInputGenerationSpecInput,
  UpdateShotVideoTakeProductionGroupInput,
  ValidateShotVideoTakeGenerationSpecInput,
  ValidateShotVideoTakeInputGenerationSpecInput,
} from '../project-data-service-contracts.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

type GenerationMode = PreparedMediaGeneration['generation']['policy']['mode'];

interface ShotVideoTakeProviderPlan {
  provider: 'fal-ai';
  model: string;
  mode: GenerationMode;
  outputCount: 1;
  payload: Record<string, unknown>;
  inputFiles: PreparedMediaGeneration['generation']['request']['inputFiles'];
}

interface RequiredShotVideoTakeInputSlot {
  outputInputKind: ShotVideoTakeInputKind;
  dependencyKind?: ShotVideoTakePreflightDependency['dependencyKind'];
  purpose?: ShotVideoTakePreflightDependency['purpose'];
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  mediaKind: 'image' | 'audio' | 'video';
  reason: string;
}

const INPUT_MODEL_CHOICES = new Set<ShotVideoTakeInputModelChoice>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

const PURPOSE_CONFIG: Record<
  ShotVideoTakeInputGenerationPurpose,
  {
    dependencyKind:
      | 'first-frame'
      | 'last-frame'
      | 'shot-reference-sheet'
      | 'multi-shot-storyboard-sheet';
    outputInputKind:
      | 'first-frame'
      | 'last-frame'
      | 'shot-reference-sheet'
      | 'multi-shot-storyboard-sheet';
    title: string;
  }
> = {
  [SHOT_FIRST_FRAME_GENERATION_PURPOSE]: {
    dependencyKind: 'first-frame',
    outputInputKind: 'first-frame',
    title: 'Shot first frame',
  },
  [SHOT_LAST_FRAME_GENERATION_PURPOSE]: {
    dependencyKind: 'last-frame',
    outputInputKind: 'last-frame',
    title: 'Shot last frame',
  },
  [SHOT_REFERENCE_SHEET_GENERATION_PURPOSE]: {
    dependencyKind: 'shot-reference-sheet',
    outputInputKind: 'shot-reference-sheet',
    title: 'Shot reference sheet',
  },
  [SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE]: {
    dependencyKind: 'multi-shot-storyboard-sheet',
    outputInputKind: 'multi-shot-storyboard-sheet',
    title: 'Shot multi-shot storyboard sheet',
  },
};

export async function buildShotVideoTakeContext(
  input: ShotVideoTakeContextInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({ session, input, now });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

export async function listShotVideoTakeModels(
  input: ShotVideoTakeModelListInput
): Promise<ShotVideoTakeModelListReport> {
  const context = await buildShotVideoTakeContext(input);
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: context.target,
    ...(input.intentId ? { intentId: input.intentId } : {}),
    models: modelChoices(context, input.intentId),
  };
}

export async function listShotVideoTakeInputs(input: ShotVideoTakeContextInput) {
  const context = await buildShotVideoTakeContext(input);
  return {
    inputs: context.availableInputs,
    resourceKeys: context.resourceKeys,
  };
}

export async function updateShotVideoTakeProductionGroup(
  input: UpdateShotVideoTakeProductionGroupInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      production: input.production,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

export async function previewShotVideoTakeProduction(
  input: PreviewShotVideoTakeProductionInput
): Promise<ShotVideoTakePreflightReport> {
  if (input.production) {
    await updateShotVideoTakeProductionGroup({ ...input, production: input.production });
  }
  const context = await buildShotVideoTakeContext(input);
  const issues = validatePreflight(context);
  const intentId = context.productionGroup.videoTakeProduction.intentId ?? context.defaults.intentId;
  const modelChoice =
    context.productionGroup.videoTakeProduction.modelChoice ??
    defaultModelChoiceForIntent(intentId);
  const preparedInputs = await withShotProjectSession(input, ({ session }) =>
    preparedInputsForContext(context, session, issues)
  );
  const inputsToCreate = missingDependencies(context, intentId, modelChoice, preparedInputs);
  const finalDraft = context.productionGroup.videoTakeProduction.agentProposal?.finalPromptDraft;
  const prompts = [
    ...context.productionGroup.videoTakeProduction.agentProposal?.dependencyDrafts.map((draft) => ({
      purpose: draft.purpose,
      prompt: draft.prompt,
      title: draft.title,
    })) ?? [],
    ...(finalDraft
      ? [
          {
            purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
            prompt: finalDraft.prompt,
            negativePrompt: finalDraft.negativePrompt,
            title: finalDraft.title,
          },
        ]
      : []),
  ];
  const estimateLineIssues =
    inputsToCreate.length > 0
      ? [
          issue(
            'PROJECT_DATA373',
            'Final video estimate requires prepared inputs that do not exist yet.',
            ['productionGroup', 'videoTakeProduction', 'preparedInputs'],
            'Generate or select the listed prerequisite inputs, then run preflight again.'
          ),
        ]
      : [];
  return {
    valid: issues.length === 0 && inputsToCreate.length === 0,
    issues: [...issues, ...estimateLineIssues],
    target: context.target,
    productionGroup: context.productionGroup,
    intentId,
    modelChoice,
    preparedInputs,
    availableInputs: context.availableInputs,
    inputsToCreate,
    prompts,
    estimateLines: [
      ...inputsToCreate
        .filter(
          (
            inputToCreate
          ): inputToCreate is ShotVideoTakePreflightDependency & {
            purpose: NonNullable<ShotVideoTakePreflightDependency['purpose']>;
          } => Boolean(inputToCreate.purpose)
        )
        .map((inputToCreate) => ({
          purpose: inputToCreate.purpose,
          dependencyKind: inputToCreate.dependencyKind,
          label: inputToCreate.reason,
          estimate: null,
          issues: [
            issue(
              'PROJECT_DATA374',
              'Dependency estimate requires a persisted dependency spec.',
              ['inputsToCreate'],
              'Create the concrete dependency spec before estimating it.'
            ),
          ],
        })),
      {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        label: 'Final video take',
        estimate: null,
        issues: estimateLineIssues,
      },
    ],
    finalTake: {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      canCreateSpec: issues.length === 0 && inputsToCreate.length === 0,
      title: finalDraft?.title ?? `${context.scene.title} video take`,
    },
    agentBrief: agentBrief(context),
    estimate: null,
  };
}

export async function selectShotVideoTakeInput(
  input: SelectShotVideoTakeInputInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({ session, input, now });
    const selectedBeforeMutation = requireShotVideoTakeInput(session, input.inputId);
    if (
      selectedBeforeMutation.productionGroupId !== prepared.productionGroup.productionGroupId ||
      !sameShotIds(selectedBeforeMutation.shotIds, prepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different production group.'
      );
    }
    const selected = selectShotVideoTakeInputRecord(session, {
      inputId: input.inputId,
      now,
    });
    updatePreparedInputSelection({
      session,
      prepared,
      now,
      input: selected,
      selected: true,
    });
    return buildContextFromPrepared({ session, projectFolder, project, prepared });
  });
}

export async function clearShotVideoTakeInputSelection(
  input: ClearShotVideoTakeInputSelectionInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({ session, input, now });
    clearShotVideoTakeInputRecordSelection(session, {
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      productionGroupId: prepared.productionGroup.productionGroupId,
      inputKind: input.kind,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      now,
    });
    updatePreparedInputSelection({
      session,
      prepared,
      now,
      input: {
        kind: input.kind,
        assetId: '',
        assetFileId: '',
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
      },
      selected: false,
    });
    return buildContextFromPrepared({ session, projectFolder, project, prepared });
  });
}

export async function validateShotInputSpec(input: ValidateShotVideoTakeInputGenerationSpecInput) {
  const normalized = normalizeInputSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: normalized.target.sceneId,
    shotListId: normalized.target.shotListId,
    shotIds: normalized.target.shotIds,
    productionGroupId: normalized.target.productionGroupId,
  });
  validateInputSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeInputProviderPayload(normalized);
  return { valid: true as const, spec: normalized, providerPayload: plan.payload };
}

export const validateShotFirstFrameSpec = validateShotInputSpec;
export const validateShotLastFrameSpec = validateShotInputSpec;
export const validateShotReferenceSheetSpec = validateShotInputSpec;
export const validateShotMultiShotStoryboardSheetSpec = validateShotInputSpec;

export async function createShotInputSpec(
  input: CreateShotVideoTakeInputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeInputSpec(input.spec);
  await validateShotInputSpec({ ...input, spec: normalized });
  return withShotProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: titleForInputSpec(normalized),
      now: new Date().toISOString(),
    });
  });
}

export const createShotFirstFrameSpec = createShotInputSpec;
export const createShotLastFrameSpec = createShotInputSpec;
export const createShotReferenceSheetSpec = createShotInputSpec;
export const createShotMultiShotStoryboardSheetSpec = createShotInputSpec;

export async function updateShotInputSpec(
  input: UpdateShotVideoTakeInputGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeInputSpec(input.spec);
  await validateShotInputSpec({ ...input, spec: normalized });
  return withShotProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: titleForInputSpec(normalized),
      now: new Date().toISOString(),
    })
  );
}

export const updateShotFirstFrameSpec = updateShotInputSpec;
export const updateShotLastFrameSpec = updateShotInputSpec;
export const updateShotReferenceSheetSpec = updateShotInputSpec;
export const updateShotMultiShotStoryboardSheetSpec = updateShotInputSpec;

export async function readShotSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withShotProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}

export const readShotFirstFrameSpec = readShotSpec;
export const readShotLastFrameSpec = readShotSpec;
export const readShotReferenceSheetSpec = readShotSpec;
export const readShotMultiShotStoryboardSheetSpec = readShotSpec;
export const readShotVideoTakeSpec = readShotSpec;

export async function listShotInputSpecs(
  input: ShotVideoTakeContextInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildShotVideoTakeContext(input);
  return withShotProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose,
      targetKind: 'sceneShotGroup',
      targetId: context.target.id,
    }),
  }));
}

export const listShotFirstFrameSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_FIRST_FRAME_GENERATION_PURPOSE);
export const listShotLastFrameSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_LAST_FRAME_GENERATION_PURPOSE);
export const listShotReferenceSheetSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_REFERENCE_SHEET_GENERATION_PURPOSE);
export const listShotMultiShotStoryboardSheetSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE);

export async function prepareShotInputSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readShotSpec(input);
  assertShotInputSpec(specRecord.spec);
  const plan = buildShotVideoTakeInputProviderPayload(specRecord.spec);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export const prepareShotFirstFrameSpec = prepareShotInputSpec;
export const prepareShotLastFrameSpec = prepareShotInputSpec;
export const prepareShotReferenceSheetSpec = prepareShotInputSpec;
export const prepareShotMultiShotStoryboardSheetSpec = prepareShotInputSpec;

export async function estimateShotInputSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareShotInputSpec(input);
  const { estimateGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  return { ...prepared, estimate };
}

export const estimateShotFirstFrameSpec = estimateShotInputSpec;
export const estimateShotLastFrameSpec = estimateShotInputSpec;
export const estimateShotReferenceSheetSpec = estimateShotInputSpec;
export const estimateShotMultiShotStoryboardSheetSpec = estimateShotInputSpec;

export async function runShotInputSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareShotInputSpec(input);
  const { estimateGeneration, runGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  const outputPaths = await resolveShotGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
  });
  return recordShotGenerationRun({
    ...input,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate,
    approvalToken: estimate.approvalToken,
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: result.diagnostics ?? {},
  });
}

export const runShotFirstFrameSpec = runShotInputSpec;
export const runShotLastFrameSpec = runShotInputSpec;
export const runShotReferenceSheetSpec = runShotInputSpec;
export const runShotMultiShotStoryboardSheetSpec = runShotInputSpec;

export async function validateShotVideoTakeSpec(
  input: ValidateShotVideoTakeGenerationSpecInput
) {
  const normalized = normalizeFinalSpec(input.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: normalized.target.sceneId,
    shotListId: normalized.target.shotListId,
    shotIds: normalized.target.shotIds,
    productionGroupId: normalized.target.productionGroupId,
  });
  validateFinalSpecAgainstContext(normalized, context);
  const plan = buildShotVideoTakeProviderPayload(normalized, context);
  return { valid: true as const, spec: normalized, providerPayload: plan.payload };
}

export async function createShotVideoTakeSpec(
  input: CreateShotVideoTakeGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeFinalSpec(input.spec);
  await validateShotVideoTakeSpec({ ...input, spec: normalized });
  return withShotProjectSession(input, ({ session }) => {
    const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
    return insertMediaGenerationSpec(session, {
      id: ids('media_generation_spec'),
      spec: normalized,
      title: normalized.title?.trim() || normalized.prompt.slice(0, 80) || 'Shot video take',
      now: new Date().toISOString(),
    });
  });
}

export async function updateShotVideoTakeSpec(
  input: UpdateShotVideoTakeGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  const normalized = normalizeFinalSpec(input.spec);
  await validateShotVideoTakeSpec({ ...input, spec: normalized });
  return withShotProjectSession(input, ({ session }) =>
    updateMediaGenerationSpec(session, {
      id: input.specId,
      spec: normalized,
      title: normalized.title?.trim() || normalized.prompt.slice(0, 80) || 'Shot video take',
      now: new Date().toISOString(),
    })
  );
}

export async function listShotVideoTakeSpecs(
  input: ShotVideoTakeContextInput
): Promise<{ specs: MediaGenerationSpecRecord[] }> {
  const context = await buildShotVideoTakeContext(input);
  return withShotProjectSession(input, ({ session }) => ({
    specs: listMediaGenerationSpecs(session, {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      targetKind: 'sceneShotGroup',
      targetId: context.target.id,
    }),
  }));
}

export async function prepareShotVideoTakeSpec(
  input: ReadMediaGenerationSpecInput
): Promise<PreparedMediaGeneration> {
  const specRecord = await readShotSpec(input);
  assertShotVideoTakeSpec(specRecord.spec);
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: specRecord.spec.target.sceneId,
    shotListId: specRecord.spec.target.shotListId,
    shotIds: specRecord.spec.target.shotIds,
    productionGroupId: specRecord.spec.target.productionGroupId,
  });
  validateFinalSpecAgainstContext(specRecord.spec, context);
  const plan = buildShotVideoTakeProviderPayload(specRecord.spec, context);
  return {
    spec: specRecord,
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, specRecord.spec),
  };
}

export async function estimateShotVideoTakeSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationEstimateReport> {
  const prepared = await prepareShotVideoTakeSpec(input);
  const { estimateGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  return { ...prepared, estimate };
}

export async function runShotVideoTakeSpec(
  input: RunMediaGenerationSpecInput
): Promise<MediaGenerationRunReport> {
  const prepared = await prepareShotVideoTakeSpec(input);
  const { estimateGeneration, runGeneration } = await import('@gorenku/studio-engines');
  const estimate = await estimateGeneration(prepared.generation);
  const outputPaths = await resolveShotGenerationOutputPaths(input);
  const result = await runGeneration({
    ...prepared.generation,
    mode: input.simulate ? 'simulated' : 'live',
    approvalToken: input.approvalToken,
    outputRoot: outputPaths.absoluteRoot,
    outputProjectRelativeRoot: outputPaths.projectRelativeRoot,
    inputRoot: outputPaths.projectFolder,
  });
  return recordShotGenerationRun({
    ...input,
    provider: prepared.generation.policy.provider,
    model: prepared.generation.policy.model,
    providerPayload: prepared.providerPayload,
    estimate,
    approvalToken: estimate.approvalToken,
    simulated: Boolean(input.simulate),
    status: input.simulate ? 'simulated' : 'completed',
    outputs: result.outputs,
    diagnostics: result.diagnostics ?? {},
  });
}

export async function importShotInputMedia(
  input: ImportShotVideoTakeInputMediaInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<ShotVideoTakeInputMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({ session, input, now });
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? PURPOSE_CONFIG[purpose].title,
      mediaKind: 'image',
      assetType: purpose,
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const subject =
      PURPOSE_CONFIG[purpose].outputInputKind === 'multi-shot-storyboard-sheet'
        ? {
            subjectKind: 'production-group' as const,
            subjectId: prepared.productionGroup.productionGroupId,
          }
        : {
            subjectKind: 'shot' as const,
            subjectId: prepared.orderedShotIds[0] as string,
          };
    const relationship = insertShotVideoTakeInputRecord(session, {
      id: imported.nextId('scene_shot_video_take_input'),
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      productionGroupId: prepared.productionGroup.productionGroupId,
      inputKind: PURPOSE_CONFIG[purpose].outputInputKind,
      ...subject,
      assetId: imported.assetId,
      assetFileId: imported.assetFileId,
      mediaGenerationRunId: receiptRunId(input.receipt),
      selection: input.selection ?? 'select',
      shotIds: prepared.orderedShotIds,
      now,
    });
    if (relationship.selected) {
      updatePreparedInputSelection({
        session,
        prepared,
        now,
        input: relationship,
        selected: true,
      });
    }
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'shotVideoTake.inputImported', inputId: relationship.inputId }],
      purpose,
      target: prepared.target,
      imported: imported.asset,
      input: relationship,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: shotVideoTakeResourceKeys(prepared).concat([
        `scene-shot-video-take-input:${relationship.inputId}`,
        `asset:${imported.assetId}`,
      ]),
    };
  });
}

export const importShotFirstFrame = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_FIRST_FRAME_GENERATION_PURPOSE);
export const importShotLastFrame = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_LAST_FRAME_GENERATION_PURPOSE);
export const importShotReferenceSheet = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_REFERENCE_SHEET_GENERATION_PURPOSE);
export const importShotMultiShotStoryboardSheet = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE);

export async function importShotVideoTake(
  input: ImportShotVideoTakeMediaInput
): Promise<ShotVideoTakeMediaImportReport> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({ session, input, now });
    const imported = await importGeneratedFile({
      session,
      projectFolder,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title ?? 'Shot video take',
      mediaKind: 'video',
      assetType: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      origin: input.receipt ? 'generated' : 'imported',
      idGenerator: input.idGenerator,
      now,
    });
    const take = insertShotVideoTakeRecord(session, {
      id: imported.nextId('scene_shot_video_take'),
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      productionGroupId: prepared.productionGroup.productionGroupId,
      assetId: imported.assetId,
      assetFileId: imported.assetFileId,
      mediaGenerationRunId: receiptRunId(input.receipt),
      shotIds: prepared.orderedShotIds,
      isSelected: input.isSelected ?? true,
      now,
    });
    return {
      valid: true,
      warnings: [],
      project: toProjectReport(project, projectFolder),
      changes: [{ type: 'shotVideoTake.imported', takeId: take.takeId }],
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target: prepared.target,
      imported: imported.asset,
      take,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys: shotVideoTakeResourceKeys(prepared).concat([
        `asset:${imported.assetId}`,
      ]),
    };
  });
}

async function recordShotGenerationRun(
  input: RunMediaGenerationSpecInput & {
    provider: 'fal-ai';
    model: string;
    providerPayload: Record<string, unknown>;
    estimate: unknown;
    approvalToken?: string;
    simulated: boolean;
    status: 'simulated' | 'completed' | 'failed';
    outputs: unknown;
    diagnostics: unknown;
  }
): Promise<MediaGenerationRunReport> {
  const specRecord = await readShotSpec(input);
  const now = new Date().toISOString();
  const run = await withShotProjectSession(input, ({ session }) => {
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

export function buildShotVideoTakeProviderPayload(
  spec: ShotVideoTakeGenerationSpec,
  _context: ShotVideoTakeGenerationContext
): ShotVideoTakeProviderPlan {
  const parameters = { ...spec.parameterValues };
  const inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']> = [];
  const payload: Record<string, unknown> = {
    prompt: spec.prompt,
    ...parameters,
  };
  if (spec.negativePrompt) {
    payload.negative_prompt = spec.negativePrompt;
  }
  const model = providerModel(spec.modelChoice);
  let mode: GenerationMode = 'text-to-video';
  if (spec.intentId === 'first-last-frame') {
    mode = 'image-to-video';
    mapRequiredInput(spec, inputFiles, 'first-frame', 'first_frame_url');
    mapRequiredInput(spec, inputFiles, 'last-frame', 'last_frame_url');
  } else if (spec.intentId === 'first-frame') {
    mode = 'image-to-video';
    mapRequiredInput(spec, inputFiles, 'first-frame', 'image_url');
  } else if (spec.intentId === 'reference' || spec.intentId === 'multi-shot') {
    mode = model.includes('text-to-video') ? 'text-to-video' : 'image-to-video';
    mapOptionalReferenceInputs(spec, inputFiles);
  }
  return {
    provider: 'fal-ai',
    model,
    mode,
    outputCount: 1,
    payload,
    inputFiles,
  };
}

function buildShotVideoTakeInputProviderPayload(
  spec: ShotVideoTakeInputGenerationSpec
): ShotVideoTakeProviderPlan {
  const payload = {
    prompt: spec.prompt,
    ...spec.parameterValues,
    sync_mode: false,
  };
  return {
    provider: 'fal-ai',
    model: providerModel(spec.modelChoice),
    mode: 'text-to-image',
    outputCount: 1,
    payload,
    inputFiles: [],
  };
}

function toGenerationRequest(
  plan: ShotVideoTakeProviderPlan,
  spec: ShotVideoTakeInputGenerationSpec | ShotVideoTakeGenerationSpec
): PreparedMediaGeneration['generation'] {
  const { prompt, ...parameters } = plan.payload;
  return {
    policy: {
      provider: plan.provider,
      model: plan.model,
      mediaKind: spec.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE ? 'video' : 'image',
      mode: plan.mode,
      outputCount: plan.outputCount,
    },
    request: {
      prompt: typeof prompt === 'string' ? prompt : spec.prompt,
      ...(plan.inputFiles && plan.inputFiles.length > 0
        ? { inputFiles: plan.inputFiles }
        : {}),
      parameters,
      outputNames: [outputName(spec)],
    },
  };
}

function mapRequiredInput(
  spec: ShotVideoTakeGenerationSpec,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  kind: ShotVideoTakeInputKind,
  field: string
): void {
  const input = spec.inputs.find((candidate) => candidate.kind === kind);
  if (!input) {
    throw new ProjectDataError(
      'PROJECT_DATA363',
      `Shot video take spec requires a prepared ${kind} input.`
    );
  }
  inputFiles.push({
    field,
    projectRelativePath: input.projectRelativePath,
    mediaKind: input.mediaKind,
    required: true,
  });
}

function mapOptionalReferenceInputs(
  spec: ShotVideoTakeGenerationSpec,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>
): void {
  const references = spec.inputs.filter((input) =>
    [
      'reference-image',
      'character-sheet',
      'location-sheet',
      'shot-reference-sheet',
      'multi-shot-storyboard-sheet',
    ].includes(input.kind)
  );
  references.forEach((input) => {
    inputFiles.push({
      field: 'image_urls',
      projectRelativePath: input.projectRelativePath,
      mediaKind: input.mediaKind,
      asArray: true,
      required: spec.intentId === 'multi-shot' && input.kind === 'multi-shot-storyboard-sheet',
    });
  });
}

function normalizeInputSpec(
  spec: ShotVideoTakeInputGenerationSpec
): ShotVideoTakeInputGenerationSpec {
  if (!isShotInputPurpose(spec.purpose)) {
    throw new ProjectDataError(
      'PROJECT_DATA364',
      `Unsupported shot video take input purpose: ${spec.purpose}.`
    );
  }
  if (!INPUT_MODEL_CHOICES.has(spec.modelChoice)) {
    throw new ProjectDataError(
      'PROJECT_DATA365',
      `Unsupported shot video take input model: ${spec.modelChoice}.`
    );
  }
  const config = PURPOSE_CONFIG[spec.purpose];
  if (
    spec.dependencyKind !== config.dependencyKind ||
    spec.outputInputKind !== config.outputInputKind
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA366',
      'Shot video take input spec purpose, dependencyKind, and outputInputKind do not match.'
    );
  }
  return { ...spec, parameterValues: spec.parameterValues ?? {} };
}

function normalizeFinalSpec(spec: ShotVideoTakeGenerationSpec): ShotVideoTakeGenerationSpec {
  if (spec.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'PROJECT_DATA367',
      `Unsupported shot video take final purpose: ${spec.purpose}.`
    );
  }
  return { ...spec, parameterValues: spec.parameterValues ?? {}, inputs: spec.inputs ?? [] };
}

function validateInputSpecAgainstContext(
  spec: ShotVideoTakeInputGenerationSpec,
  context: ShotVideoTakeGenerationContext
): void {
  if (!sameShotIds(spec.target.shotIds, context.target.shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA368',
      'Shot video take input spec targets a stale shot group.'
    );
  }
  if (
    spec.purpose === SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE &&
    context.target.shotIds.length < 2
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA369',
      'shot.multi-shot-storyboard-sheet requires a multi-shot production group.'
    );
  }
}

function validateFinalSpecAgainstContext(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext
): void {
  if (!sameShotIds(spec.target.shotIds, context.target.shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA370',
      'Shot video take spec targets a stale shot group.'
    );
  }
  validateIntentForShotCount(spec.intentId, spec.target.shotIds);
  const report = modelChoices(context).find((model) => model.modelChoice === spec.modelChoice);
  if (!report || !report.supportedIntents.includes(spec.intentId)) {
    throw new ProjectDataError(
      'PROJECT_DATA371',
      'Shot video take model does not support the selected intent.'
    );
  }
  for (const key of Object.keys(spec.parameterValues)) {
    if (!report.parameters.some((parameter) => parameter.name === key)) {
      throw new ProjectDataError(
        'PROJECT_DATA372',
        `Unsupported shot video take parameter for selected model: ${key}.`
      );
    }
  }
  const missingInputs = requiredInputSlots(context, spec.intentId, spec.modelChoice).filter(
    (slot) => !spec.inputs.some((input) => finalInputMatchesSlot(input, slot))
  );
  if (missingInputs.length > 0) {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      `Shot video take spec is missing required input${
        missingInputs.length === 1 ? '' : 's'
      }: ${missingInputs.map((input) => requiredInputLabel(input)).join(', ')}.`
    );
  }
}

function assertShotInputSpec(
  spec: unknown
): asserts spec is ShotVideoTakeInputGenerationSpec {
  if (!spec || typeof spec !== 'object' || !isShotInputPurpose((spec as { purpose?: string }).purpose)) {
    throw new ProjectDataError('PROJECT_DATA364', 'Media generation spec is not a shot video take input spec.');
  }
}

function assertShotVideoTakeSpec(
  spec: unknown
): asserts spec is ShotVideoTakeGenerationSpec {
  if (!spec || typeof spec !== 'object' || (spec as { purpose?: string }).purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError('PROJECT_DATA367', 'Media generation spec is not a shot video take spec.');
  }
}

function modelChoices(
  context: ShotVideoTakeGenerationContext,
  intentId?: ShotVideoTakeIntentId
): ShotVideoTakeModelChoiceReport[] {
  const models: ShotVideoTakeModelChoiceReport[] = [
    modelReport({
      modelChoice: 'fal-ai/xai/grok-imagine-video/text-to-video',
      label: 'Grok Imagine Video Text',
      supportedIntents: ['text-only'],
      inputRoles: [],
      durationValues: [6],
    }),
    modelReport({
      modelChoice: 'fal-ai/xai/grok-imagine-video/image-to-video',
      label: 'Grok Imagine Video Image',
      supportedIntents: ['first-frame', 'reference'],
      inputRoles: [
        { kind: 'first-frame', required: true, minCount: 1, maxCount: 1, mediaKind: 'image' },
      ],
      durationValues: [6],
    }),
    modelReport({
      modelChoice: 'fal-ai/veo3.1/first-last-frame-to-video',
      label: 'Veo 3.1 First/Last Frame',
      supportedIntents: ['first-last-frame'],
      inputRoles: [
        { kind: 'first-frame', required: true, minCount: 1, maxCount: 1, mediaKind: 'image' },
        { kind: 'last-frame', required: true, minCount: 1, maxCount: 1, mediaKind: 'image' },
      ],
      durationValues: [4, 6, 8],
    }),
    modelReport({
      modelChoice: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
      label: 'Seedance Pro Text',
      supportedIntents: ['text-only', 'multi-shot'],
      inputRoles: [
        { kind: 'multi-shot-storyboard-sheet', required: context.target.shotIds.length > 1, minCount: 0, maxCount: 1, mediaKind: 'image' },
      ],
      durationValues: [5, 8, 10],
    }),
    modelReport({
      modelChoice: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
      label: 'Seedance Pro Image',
      supportedIntents: ['first-frame', 'reference', 'multi-shot'],
      inputRoles: [
        { kind: 'first-frame', required: true, minCount: 1, maxCount: 1, mediaKind: 'image' },
        { kind: 'multi-shot-storyboard-sheet', required: false, minCount: 0, maxCount: 1, mediaKind: 'image' },
      ],
      durationValues: [5, 8, 10],
    }),
  ];
  return models.map((model) => ({
    ...model,
    available:
      (!intentId || model.supportedIntents.includes(intentId)) &&
      intentCompatibleWithGroup(intentId ?? context.defaults.intentId, context.target.shotIds),
    ...(!intentId || model.supportedIntents.includes(intentId)
      ? {}
      : { unavailableReason: `This model does not support ${intentId}.` }),
  }));
}

function modelReport(input: {
  modelChoice: ShotVideoTakeModelChoice;
  label: string;
  supportedIntents: ShotVideoTakeIntentId[];
  inputRoles: ShotVideoTakeModelChoiceReport['inputRoles'];
  durationValues: number[];
}): ShotVideoTakeModelChoiceReport {
  return {
    modelChoice: input.modelChoice,
    label: input.label,
    available: true,
    supportedIntents: input.supportedIntents,
    duration: {
      supported: true,
      values: input.durationValues,
      default: input.durationValues[0],
    },
    inputRoles: input.inputRoles,
    parameters: [
      {
        name: 'duration',
        label: 'Duration',
        required: false,
        defaultValue: String(input.durationValues[0]),
        allowedValues: input.durationValues.map((value) => String(value)),
      },
      {
        name: 'aspect_ratio',
        label: 'Aspect Ratio',
        required: false,
        defaultValue: '16:9',
        allowedValues: ['16:9', '9:16', '4:3', '1:1', 'auto'],
      },
    ],
    estimateInputs: {
      canEstimateBeforeDependenciesExist: input.inputRoles.length === 0,
      requiresPreparedInputs: input.inputRoles.some((role) => role.required),
    },
  };
}

function validatePreflight(context: ShotVideoTakeGenerationContext): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const plan = context.productionGroup.videoTakeProduction;
  const intentId = plan.intentId ?? context.defaults.intentId;
  if (!intentCompatibleWithGroup(intentId, context.target.shotIds)) {
    issues.push(
      issue(
        'PROJECT_DATA375',
        'Shot video take intent is not compatible with the production group size.',
        ['productionGroup', 'videoTakeProduction', 'intentId'],
        'Use multi-shot for grouped shots and a single-shot intent for one shot.'
      )
    );
  }
  if (plan.agentProposal) {
    if (plan.agentProposal.basedOnIntentId !== intentId) {
      issues.push(
        issue(
          'PROJECT_DATA376',
          'Shot video take agent proposal is stale for the current intent.',
          ['productionGroup', 'videoTakeProduction', 'agentProposal', 'basedOnIntentId'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
    const modelChoice = plan.modelChoice ?? defaultModelChoiceForIntent(intentId);
    if (plan.agentProposal.basedOnModelChoice !== modelChoice) {
      issues.push(
        issue(
          'PROJECT_DATA377',
          'Shot video take agent proposal is stale for the current model.',
          ['productionGroup', 'videoTakeProduction', 'agentProposal', 'basedOnModelChoice'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
  }
  return issues;
}

function preparedInputsForContext(
  context: ShotVideoTakeGenerationContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  const inputs: Array<ShotVideoTakePreflightInput | null> = (context.productionGroup.videoTakeProduction.preparedInputs ?? [])
    .map((input) => {
      const available = context.availableInputs.find(
        (candidate) =>
          candidate.assetId === input.assetId &&
          candidate.assetFileId === input.assetFileId &&
          candidate.kind === input.kind
      );
      const assetFile = available ?? (input.assetFileId
        ? readAssetFileRecord(session, {
            assetId: input.assetId,
            assetFileId: input.assetFileId,
          })
        : null);
      if (!assetFile) {
        issues.push(
          issue(
            'PROJECT_DATA378',
            'Prepared shot video take input does not resolve to an asset file.',
            ['productionGroup', 'videoTakeProduction', 'preparedInputs'],
            'Select an existing reusable input or import the missing dependency again.'
          )
        );
        return null;
      }
      return {
        kind: input.kind,
        assetId: input.assetId,
        assetFileId: available ? available.assetFileId : input.assetFileId as string,
        role: 'role' in assetFile ? assetFile.role : input.kind as string,
        mediaKind: assetFile.mediaKind as 'image' | 'audio' | 'video',
        projectRelativePath: assetFile.projectRelativePath as ProjectRelativePath,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
      };
    });
  return inputs.filter((input): input is ShotVideoTakePreflightInput => Boolean(input));
}

function missingDependencies(
  context: ShotVideoTakeGenerationContext,
  intentId: ShotVideoTakeIntentId,
  modelChoice: ShotVideoTakeModelChoice,
  preparedInputs: ShotVideoTakePreflightInput[]
): ShotVideoTakePreflightDependency[] {
  return requiredInputSlots(context, intentId, modelChoice)
    .filter((slot) => !preparedInputs.some((input) => preparedInputMatchesSlot(input, slot)))
    .map((slot) => ({
      ...(slot.dependencyKind ? { dependencyKind: slot.dependencyKind } : {}),
      ...(slot.purpose ? { purpose: slot.purpose } : {}),
      outputInputKind: slot.outputInputKind,
      ...(slot.subjectKind ? { subjectKind: slot.subjectKind } : {}),
      ...(slot.subjectId ? { subjectId: slot.subjectId } : {}),
      mediaKind: slot.mediaKind,
      reason: slot.reason,
    }));
}

function requiredInputSlots(
  context: ShotVideoTakeGenerationContext,
  intentId: ShotVideoTakeIntentId,
  modelChoice: ShotVideoTakeModelChoice
): RequiredShotVideoTakeInputSlot[] {
  const report = modelChoices(context, intentId).find((model) => model.modelChoice === modelChoice);
  const modelSlots =
    report?.inputRoles
      .filter((role) => role.required)
      .map((role) =>
        requiredSlotForInputKind(
          role.kind,
          role.mediaKind,
          `The selected ${report.label} model requires a ${role.kind} input.`
        )
      ) ?? [];
  const planSlots = (context.productionGroup.videoTakeProduction.requestedInputs ?? []).map(
    requiredSlotForRequestedInput
  );
  return uniqueRequiredInputSlots([...modelSlots, ...planSlots]);
}

function requiredSlotForRequestedInput(
  input: ShotVideoTakeRequestedInput
): RequiredShotVideoTakeInputSlot {
  const subjectLabel =
    input.subjectKind && input.subjectId ? ` for ${input.subjectKind} ${input.subjectId}` : '';
  return requiredSlotForInputKind(
    input.kind,
    mediaKindForInputKind(input.kind),
    input.note?.trim() ||
      `Required ${input.kind}${subjectLabel} is missing. Select or import it before generating the final video take.`,
    input.subjectKind,
    input.subjectId
  );
}

function requiredSlotForInputKind(
  kind: ShotVideoTakeInputKind,
  mediaKind: 'image' | 'audio' | 'video',
  reason: string,
  subjectKind?: ShotVideoTakeInputSubjectKind,
  subjectId?: string
): RequiredShotVideoTakeInputSlot {
  const dependency = dependencyForInputKind(kind);
  return {
    outputInputKind: kind,
    ...(dependency ? dependency : {}),
    ...(subjectKind ? { subjectKind } : {}),
    ...(subjectId ? { subjectId } : {}),
    mediaKind,
    reason,
  };
}

function dependencyForInputKind(
  kind: ShotVideoTakeInputKind
): Pick<RequiredShotVideoTakeInputSlot, 'dependencyKind' | 'purpose'> | null {
  if (kind === 'first-frame') {
    return { dependencyKind: 'first-frame', purpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE };
  }
  if (kind === 'last-frame') {
    return { dependencyKind: 'last-frame', purpose: SHOT_LAST_FRAME_GENERATION_PURPOSE };
  }
  if (kind === 'shot-reference-sheet') {
    return {
      dependencyKind: 'shot-reference-sheet',
      purpose: SHOT_REFERENCE_SHEET_GENERATION_PURPOSE,
    };
  }
  if (kind === 'multi-shot-storyboard-sheet') {
    return {
      dependencyKind: 'multi-shot-storyboard-sheet',
      purpose: SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
    };
  }
  return null;
}

function mediaKindForInputKind(kind: ShotVideoTakeInputKind): 'image' | 'audio' | 'video' {
  if (kind === 'audio') {
    return 'audio';
  }
  if (kind === 'source-video') {
    return 'video';
  }
  return 'image';
}

function uniqueRequiredInputSlots(
  slots: RequiredShotVideoTakeInputSlot[]
): RequiredShotVideoTakeInputSlot[] {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const key = [
      slot.outputInputKind,
      slot.subjectKind ?? '',
      slot.subjectId ?? '',
      slot.mediaKind,
    ].join(':');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function preparedInputMatchesSlot(
  input: ShotVideoTakePreflightInput,
  slot: RequiredShotVideoTakeInputSlot
): boolean {
  return (
    input.kind === slot.outputInputKind &&
    input.mediaKind === slot.mediaKind &&
    (!slot.subjectKind || input.subjectKind === slot.subjectKind) &&
    (!slot.subjectId || input.subjectId === slot.subjectId)
  );
}

function finalInputMatchesSlot(
  input: ShotVideoTakeGenerationSpec['inputs'][number],
  slot: RequiredShotVideoTakeInputSlot
): boolean {
  return (
    input.kind === slot.outputInputKind &&
    input.mediaKind === slot.mediaKind &&
    (!slot.subjectKind || input.subjectKind === slot.subjectKind) &&
    (!slot.subjectId || input.subjectId === slot.subjectId)
  );
}

function requiredInputLabel(input: RequiredShotVideoTakeInputSlot): string {
  const subject =
    input.subjectKind && input.subjectId ? ` (${input.subjectKind} ${input.subjectId})` : '';
  return `${input.outputInputKind}${subject}`;
}

interface PreparedShotGroup {
  shotListId: string;
  sceneId: string;
  shotListRow: ReturnType<typeof requireSceneShotListForScene>;
  shotList: ReturnType<typeof readSceneShotListDocument>;
  productionGroup: ShotVideoTakeProductionGroup;
  orderedShotIds: string[];
  target: SceneShotMediaGenerationTarget;
}

function prepareShotGroupInSession(input: {
  session: DatabaseSession;
  input: ShotVideoTakeContextInput;
  now: string;
  production?: ShotVideoTakeProductionPlan;
}): PreparedShotGroup {
  const screenplay = requireScreenplayDocument(input.session);
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.input.sceneId,
    shotListId: input.input.shotListId,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  const orderedShotIds = normalizeShotIds(shotList.shots, input.input.shotIds);
  validateIntentForShotCount(input.production?.intentId, orderedShotIds);
  const ids = createUniqueIdAllocator(input.input.idGenerator ?? createRandomIdGenerator());
  const productionGroups = (shotList.videoTakeProductionGroups ?? []).filter(
    (group) => group.shotIds.length > 0
  );
  const existingIndex = productionGroups.findIndex((group) =>
    input.input.productionGroupId
      ? group.productionGroupId === input.input.productionGroupId
      : sameShotIds(group.shotIds, orderedShotIds)
  );
  const productionGroup =
    existingIndex >= 0
      ? {
          ...productionGroups[existingIndex],
          shotIds: orderedShotIds,
          videoTakeProduction:
            input.production ?? productionGroups[existingIndex].videoTakeProduction,
        }
      : {
          productionGroupId: input.input.productionGroupId ?? ids('scene_shot_video_take_group'),
          shotIds: orderedShotIds,
          videoTakeProduction: input.production ?? {},
        };
  if (existingIndex >= 0) {
    productionGroups[existingIndex] = productionGroup;
  } else {
    productionGroups.push(productionGroup);
  }
  const updatedShotList = {
    ...shotList,
    videoTakeProductionGroups: productionGroups
      .filter((group) => group.shotIds.length > 0)
      .map((group) => ({
        ...group,
        shotIds: normalizeShotIds(shotList.shots, group.shotIds),
      })),
  };
  updateSceneShotListRecordDocument({
    session: input.session,
    id: input.input.shotListId,
    document: updatedShotList,
    screenplay,
    now: input.now,
  });
  const target = {
    kind: 'sceneShotGroup' as const,
    id: sceneShotGroupTargetId({
      sceneId: input.input.sceneId,
      shotListId: input.input.shotListId,
      productionGroupId: productionGroup.productionGroupId,
    }),
    sceneId: input.input.sceneId,
    shotListId: input.input.shotListId,
    productionGroupId: productionGroup.productionGroupId,
    shotIds: orderedShotIds,
  };
  return {
    shotListId: input.input.shotListId,
    sceneId: input.input.sceneId,
    shotListRow,
    shotList: updatedShotList,
    productionGroup,
    orderedShotIds,
    target,
  };
}

function buildContextFromPrepared(input: {
  session: DatabaseSession;
  projectFolder: string;
  project: Pick<ProjectRecord, 'id' | 'name'>;
  prepared: PreparedShotGroup;
}): ShotVideoTakeGenerationContext {
  const screenplay = requireScreenplayDocument(input.session);
  const hierarchy = requireSceneHierarchy(screenplay, input.prepared.sceneId);
  const projectInfo = readProjectInformationResourceFromDatabase(input.session);
  const shots = input.prepared.orderedShotIds.map((shotId) =>
    requireShot(input.prepared.shotList.shots, shotId)
  );
  const castIds = new Set(shots.flatMap((shot) => shot.castMemberIds));
  const locationIds = new Set(shots.flatMap((shot) => shot.locationIds));
  const activeLookbook = readActiveLookbookId(input.session);
  const activeShotListId = readActiveSceneShotListId(input.session, input.prepared.sceneId);
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: input.prepared.target,
    project: {
      id: input.project.id,
      name: input.project.name,
      title: projectInfo.title,
      aspectRatio: projectInfo.aspectRatio ?? '16:9',
    },
    scene: {
      id: hierarchy.scene.id as string,
      title: hierarchy.scene.title,
      setting: hierarchy.scene.setting,
      storyFunction: hierarchy.scene.storyFunction ?? [],
    },
    shotList: {
      id: input.prepared.shotListId,
      title: input.prepared.shotList.title,
      summary: input.prepared.shotList.summary,
      createdAt: input.prepared.shotListRow.createdAt,
      updatedAt: input.prepared.shotListRow.updatedAt,
      isActive: activeShotListId === input.prepared.shotListId,
    },
    productionGroup: input.prepared.productionGroup,
    shots,
    referencedCast: screenplay.cast
      .filter((castMember) => castMember.id && castIds.has(castMember.id))
      .map((castMember) => ({
        id: castMember.id as string,
        handle: castMember.handle,
        name: castMember.name,
        role: castMember.role,
        description: castMember.description,
      })),
    referencedLocations: screenplay.locations
      .filter((location) => location.id && locationIds.has(location.id))
      .map((location) => ({
        id: location.id as string,
        handle: location.handle,
        name: location.name,
        description: location.description,
      })),
    activeLookbook: activeLookbook
      ? (() => {
          const row = requireLookbookRecordById(input.session, activeLookbook);
          const lookbook = toLookbook(row);
          return { id: lookbook.id, name: lookbook.name, thesis: lookbook.thesis.statement };
        })()
      : null,
    storyboardImages: [],
    availableInputs: listShotVideoTakeInputRecords(input.session, {
      sceneId: input.prepared.sceneId,
      shotListId: input.prepared.shotListId,
      productionGroupId: input.prepared.productionGroup.productionGroupId,
      shotIds: input.prepared.orderedShotIds,
    }),
    existingTakes: listShotVideoTakes(input.session, {
      sceneId: input.prepared.sceneId,
      shotListId: input.prepared.shotListId,
      productionGroupId: input.prepared.productionGroup.productionGroupId,
    }),
    defaults: {
      intentId: input.prepared.orderedShotIds.length > 1 ? 'multi-shot' : 'first-frame',
      imageDependencyModelChoice: 'fal-ai/openai/gpt-image-2',
      parameterValues: {
        aspect_ratio: projectInfo.aspectRatio ?? '16:9',
      },
    },
    resourceKeys: shotVideoTakeResourceKeys(input.prepared),
  };
}

function updatePreparedInputSelection(input: {
  session: DatabaseSession;
  prepared: PreparedShotGroup;
  now: string;
  input: Pick<
    ShotVideoTakeAvailableInput,
    'kind' | 'assetId' | 'assetFileId' | 'subjectKind' | 'subjectId'
  >;
  selected: boolean;
}): void {
  const plan = input.prepared.productionGroup.videoTakeProduction;
  const preparedInputs = (plan.preparedInputs ?? []).filter(
    (candidate) =>
      candidate.kind !== input.input.kind ||
      candidate.subjectKind !== input.input.subjectKind ||
      candidate.subjectId !== input.input.subjectId
  );
  if (input.selected) {
    preparedInputs.push({
      kind: input.input.kind,
      assetId: input.input.assetId,
      assetFileId: input.input.assetFileId,
      subjectKind: input.input.subjectKind,
      subjectId: input.input.subjectId,
    });
  }
  prepareShotGroupInSession({
    session: input.session,
    input: {
      sceneId: input.prepared.sceneId,
      shotListId: input.prepared.shotListId,
      shotIds: input.prepared.orderedShotIds,
      productionGroupId: input.prepared.productionGroup.productionGroupId,
    },
    now: input.now,
    production: { ...plan, preparedInputs },
  });
}

async function importGeneratedFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceProjectRelativePath: string;
  title: string;
  mediaKind: 'image' | 'video';
  assetType: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const sourceProjectRelativePath = normalizeProjectRelativePath(input.sourceProjectRelativePath);
  const sourcePath = resolveProjectRelativePath(input.projectFolder, sourceProjectRelativePath);
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const stats = await statExistingFile(sourcePath);
  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const assetId = ids('asset');
  const assetFileId = ids('asset_file');
  insertAssetRecord(input.session, {
    id: assetId,
    type: input.assetType,
    mediaKind: input.mediaKind,
    title: input.title,
    origin: input.origin,
    availability: 'ready',
    createdAt: input.now,
    updatedAt: input.now,
  });
  insertAssetFileRecord(input.session, {
    id: assetFileId,
    assetId,
    role: 'primary',
    projectRelativePath: sourceProjectRelativePath,
    mimeType: mimeTypeForPath(sourceProjectRelativePath, input.mediaKind),
    mediaKind: input.mediaKind,
    sizeBytes: stats.size,
    contentHash: await hashFile(sourcePath),
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    assetId,
    assetFileId,
    nextId: ids,
    asset: {
      assetId,
      relationshipId: assetId,
      target: { kind: 'project' as const },
      localeId: null,
      id: assetId,
      type: input.assetType,
      mediaKind: input.mediaKind,
      title: input.title,
      oneLineSummary: null,
      origin: input.origin,
      selection: { kind: 'take' as const },
      availability: 'ready' as const,
      role: 'shot-video-take',
      sortOrder: 0,
      createdAt: input.now,
      updatedAt: input.now,
      files: [
        {
          id: assetFileId,
          role: 'primary',
          projectRelativePath: sourceProjectRelativePath,
          mimeType: mimeTypeForPath(sourceProjectRelativePath, input.mediaKind),
          mediaKind: input.mediaKind,
          sizeBytes: stats.size,
          contentHash: await hashFile(sourcePath),
          width: null,
          height: null,
          durationSeconds: null,
          createdAt: input.now,
          updatedAt: input.now,
        },
      ],
    },
  };
}

async function withShotProjectSession<T>(
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

function normalizeShotIds(shots: SceneShot[], shotIds: string[]): string[] {
  if (shotIds.length === 0) {
    throw new ProjectDataError('PROJECT_DATA379', 'Shot video take target requires at least one shot id.');
  }
  const valid = new Set(shots.map((shot) => shot.shotId));
  const unique = new Set<string>();
  for (const shotId of shotIds) {
    if (!valid.has(shotId)) {
      throw new ProjectDataError('PROJECT_DATA325', `Shot id is not in the Scene Shot List: ${shotId}.`);
    }
    if (unique.has(shotId)) {
      throw new ProjectDataError('PROJECT_DATA380', `Shot id is duplicated in the production group: ${shotId}.`);
    }
    unique.add(shotId);
  }
  const ordered = shots
    .filter((shot) => unique.has(shot.shotId))
    .map((shot) => shot.shotId);
  if (!isContiguous(ordered, shots)) {
    throw new ProjectDataError('PROJECT_DATA381', 'Grouped shot video takes must use contiguous shot ids.');
  }
  return ordered;
}

function isContiguous(shotIds: string[], shots: SceneShot[]): boolean {
  if (shotIds.length < 2) {
    return true;
  }
  const indexes = shotIds.map((shotId) => shots.findIndex((shot) => shot.shotId === shotId));
  return indexes.every((index, position) => position === 0 || index === indexes[position - 1] + 1);
}

function validateIntentForShotCount(
  intentId: ShotVideoTakeIntentId | undefined,
  shotIds: string[]
): void {
  if (!intentId) {
    return;
  }
  if (!intentCompatibleWithGroup(intentId, shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA375',
      'Shot video take intent is not compatible with the production group size.'
    );
  }
}

function intentCompatibleWithGroup(
  intentId: ShotVideoTakeIntentId,
  shotIds: string[]
): boolean {
  return shotIds.length > 1 ? intentId === 'multi-shot' : intentId !== 'multi-shot';
}

function providerModel(
  modelChoice: ShotVideoTakeInputModelChoice | ShotVideoTakeModelChoice
): string {
  if (modelChoice.startsWith('fal-ai/')) {
    return modelChoice.slice('fal-ai/'.length);
  }
  return modelChoice;
}

function defaultModelChoiceForIntent(intentId: ShotVideoTakeIntentId): ShotVideoTakeModelChoice {
  if (intentId === 'first-last-frame') {
    return 'fal-ai/veo3.1/first-last-frame-to-video';
  }
  if (intentId === 'text-only') {
    return 'fal-ai/xai/grok-imagine-video/text-to-video';
  }
  if (intentId === 'multi-shot') {
    return 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video';
  }
  return 'fal-ai/xai/grok-imagine-video/image-to-video';
}

function titleForInputSpec(spec: ShotVideoTakeInputGenerationSpec): string {
  return spec.title?.trim() || spec.prompt.slice(0, 80) || PURPOSE_CONFIG[spec.purpose].title;
}

function outputName(spec: ShotVideoTakeInputGenerationSpec | ShotVideoTakeGenerationSpec): string {
  const base = spec.title?.trim() || spec.prompt.slice(0, 40) || 'shot-video-take';
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'shot-video-take'}${
    spec.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE ? '.mp4' : '.png'
  }`;
}

async function resolveShotGenerationOutputPaths(input: RenkuConfigPathOptions & { projectName?: string }) {
  return withShotProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}

function sceneShotGroupTargetId(input: {
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
}): string {
  return `${input.sceneId}:${input.shotListId}:${input.productionGroupId}`;
}

function shotVideoTakeResourceKeys(prepared: PreparedShotGroup): string[] {
  return [
    `scene:${prepared.sceneId}`,
    `surface:scene:${prepared.sceneId}:shots`,
    `scene-shot-list:${prepared.shotListId}:video-take-production`,
    `scene-shot-video-take-group:${prepared.productionGroup.productionGroupId}`,
  ];
}

function agentBrief(context: ShotVideoTakeGenerationContext): string {
  return [
    `Scene: ${context.scene.title}`,
    `Shots: ${context.shots.map((shot) => `${shot.shotId}: ${shot.action}`).join(' | ')}`,
    `Intent: ${context.productionGroup.videoTakeProduction.intentId ?? context.defaults.intentId}`,
  ].join('\n');
}

function requireShot(shots: SceneShot[], shotId: string): SceneShot {
  const shot = shots.find((candidate) => candidate.shotId === shotId);
  if (!shot) {
    throw new ProjectDataError('PROJECT_DATA325', `Shot id is not in the Scene Shot List: ${shotId}.`);
  }
  return shot;
}

function isShotInputPurpose(value: unknown): value is ShotVideoTakeInputGenerationPurpose {
  return (
    value === SHOT_FIRST_FRAME_GENERATION_PURPOSE ||
    value === SHOT_LAST_FRAME_GENERATION_PURPOSE ||
    value === SHOT_REFERENCE_SHEET_GENERATION_PURPOSE ||
    value === SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE
  );
}

function sameShotIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((shotId, index) => shotId === right[index]);
}

function issue(
  code: string,
  message: string,
  pathSegments: string[],
  suggestion: string
): DiagnosticIssue {
  return createDiagnosticError(code, message, { path: pathSegments }, suggestion);
}

function toProjectReport(project: Pick<ProjectRecord, 'id' | 'name'>, projectFolder: string) {
  return { id: project.id, name: project.name, projectFolder };
}

function receiptRunId(receipt: unknown): string | null {
  if (receipt && typeof receipt === 'object' && 'run' in receipt) {
    const run = (receipt as { run?: { id?: unknown } }).run;
    return typeof run?.id === 'string' ? run.id : null;
  }
  if (receipt && typeof receipt === 'object' && 'id' in receipt) {
    const id = (receipt as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

async function statExistingFile(filePath: string): Promise<{ size: number; isFile(): boolean }> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError('PROJECT_DATA382', `Shot video take import source file was not found: ${filePath}.`);
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}

function assertResolvedPathInsideProject(projectFolder: string, resolvedPath: string): void {
  const relative = path.relative(projectFolder, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError('PROJECT_DATA383', 'Shot video take import source must stay inside the project folder.');
  }
}

function mimeTypeForPath(filePath: ProjectRelativePath, mediaKind: 'image' | 'video'): string {
  const extension = path.extname(filePath).toLowerCase();
  if (mediaKind === 'video') {
    return extension === '.mov' ? 'video/quicktime' : 'video/mp4';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}
