import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { asc, eq } from 'drizzle-orm';
import {
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  SHOT_VIDEO_MODEL_FAMILIES,
  normalizeShotVideoRouteSettings,
  selectShotVideoRoute,
  type ShotVideoRoute,
  type ShotVideoRouteInputSlot,
} from '@gorenku/studio-engines';
import type {
  MediaGenerationEstimateReport,
  MediaGenerationDependencyKind,
  MediaGenerationDependencyInventory,
  MediaGenerationDependencyLine,
  MediaGenerationDependencyPricing,
  MediaGenerationDependencySlot,
  MediaGenerationPlanLine,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  PreparedMediaGeneration,
  ProjectRelativePath,
  SceneShot,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeAvailableInput,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeInputPolicy,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeInputGenerationPurpose,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeInputModelChoiceReport,
  ShotVideoTakeInputModelListReport,
  ShotVideoTakeInputModeId,
  ShotVideoTakeShotGroupMode,
  ShotVideoTakeMediaImportReport,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeModelListReport,
  ShotVideoTakePreflightDependency,
  ShotVideoTakePreflightInput,
  ShotVideoTakePreflightInputItem,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionGroup,
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeProductionPlan,
  ShotVideoTakeRailGroup,
} from '../../client/index.js';
import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../client/index.js';
import { insertAssetFileRecord, readAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  listLookbookSheets,
  readLookbookSheet,
  readLookbookSheetRecord,
} from '../database/access/lookbook-sheets.js';
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
  deleteShotVideoTakeInputRecord,
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
import { sceneLocations } from '../schema/index.js';
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
  DeleteShotVideoTakeInputInput,
  ImportShotVideoTakeInputMediaInput,
  ImportShotVideoTakeMediaInput,
  PreviewShotVideoTakeProductionInput,
  PlanShotVideoTakeProductionInput,
  ReadMediaGenerationSpecInput,
  ResolveShotVideoTakeInputFileInput,
  ResolvedShotVideoTakeInputFile,
  RunMediaGenerationSpecInput,
  SelectShotVideoTakeInputInput,
  ShotVideoTakeContextInput,
  ShotVideoTakeModelListInput,
  UpdateShotVideoTakeGenerationSpecInput,
  UpdateShotVideoTakeInputGenerationSpecInput,
  UpdateShotVideoTakeProductionGroupInput,
  UpdateShotVideoTakeRailGroupsInput,
  UpdateShotVideoTakeRailGroupsReport,
  ValidateShotVideoTakeGenerationSpecInput,
  ValidateShotVideoTakeInputGenerationSpecInput,
} from '../project-data-service-contracts.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import type {
  MediaGenerationDependencyDraftSpec,
  MediaGenerationDependencyDraftSpecInput,
} from './dependency-draft-specs.js';
import type { MediaGenerationDependencyDeclarationInput } from './purpose-registry.js';
import {
  parseShotVideoInputDependencyId,
  shotVideoInputDependencyId,
} from './dependency-identifiers.js';
import { resolveMediaGenerationDependencySelection } from './dependency-selectors.js';
import {
  planMediaGenerationDependencyInventory,
  type MediaGenerationDependencyRootEstimate,
} from './dependency-inventory.js';
import { planLinesFromDependencyInventory } from './dependency-inventory-lines.js';
import { draftMediaGenerationSpecRecord } from './draft-generation.js';
import { declareShotVideoTakeDependencySlots } from './shot-video-take/dependency-slots.js';
import { buildShotVideoTakeReferenceSections } from './shot-video-take/reference-sections.js';

type GenerationMode = PreparedMediaGeneration['generation']['policy']['mode'];

interface ShotVideoTakeProviderPlan {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  mode: GenerationMode;
  outputCount: 1;
  payload: Record<string, unknown>;
  inputFiles: PreparedMediaGeneration['generation']['request']['inputFiles'];
  pricingInputCounts?: PreparedMediaGeneration['generation']['request']['pricingInputCounts'];
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
      | 'reference-image'
      | 'multi-shot-storyboard-sheet';
    outputInputKind:
      | 'first-frame'
      | 'last-frame'
      | 'reference-image'
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
  [SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE]: {
    dependencyKind: 'reference-image',
    outputInputKind: 'reference-image',
    title: 'Shot reference image',
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
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      persist: false,
    });
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
  const inputModeId = input.inputModeId ?? context.defaults.inputModeId;
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: context.target,
    ...(input.inputModeId ? { inputModeId: input.inputModeId } : {}),
    shotGroupMode: context.shotGroupMode,
    defaultModelChoice: defaultModelChoiceForInputMode(inputModeId),
    models: modelChoices(context, input.inputModeId),
  };
}

export async function listShotInputModels(
  input: ShotVideoTakeContextInput,
  purpose: ShotVideoTakeInputGenerationPurpose
): Promise<ShotVideoTakeInputModelListReport> {
  const context = await buildShotVideoTakeContext(input);
  return {
    purpose,
    target: context.target,
    defaultModelChoice: context.defaults.imageDependencyModelChoice,
    models: shotInputModelChoices(),
  };
}

export async function listShotVideoTakeInputs(input: ShotVideoTakeContextInput) {
  const context = await buildShotVideoTakeContext(input);
  return {
    inputs: context.availableInputs,
    resourceKeys: context.resourceKeys,
  };
}

export async function resolveShotVideoTakeInputFile(
  input: ResolveShotVideoTakeInputFileInput
): Promise<ResolvedShotVideoTakeInputFile> {
  return withShotProjectSession(input, ({ session, projectFolder }) => {
    const shotInput = requireShotVideoTakeInput(session, input.inputId);
    if (shotInput.assetFileId !== input.assetFileId) {
      throw new ProjectDataError(
        'PROJECT_DATA409',
        `Shot video take input file is not attached to the requested input: ${input.assetFileId}.`
      );
    }
    const fileRecord = readAssetFileRecord(session, {
      assetId: shotInput.assetId,
      assetFileId: input.assetFileId,
    });
    if (!fileRecord) {
      throw new ProjectDataError(
        'PROJECT_DATA410',
        `Shot video take input asset file was not found: ${input.assetFileId}.`
      );
    }
    const absolutePath = resolveProjectRelativePath(
      projectFolder,
      fileRecord.projectRelativePath as ProjectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    return {
      input: shotInput,
      file: {
        id: fileRecord.id,
        role: fileRecord.role,
        projectRelativePath: fileRecord.projectRelativePath as ProjectRelativePath,
        mediaKind: fileRecord.mediaKind,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        contentHash: fileRecord.contentHash,
        width: fileRecord.width,
        height: fileRecord.height,
        durationSeconds: fileRecord.durationSeconds,
      },
      absolutePath,
    };
  });
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

export async function updateShotVideoTakeRailGroups(
  input: UpdateShotVideoTakeRailGroupsInput
): Promise<UpdateShotVideoTakeRailGroupsReport> {
  return withShotProjectSession(input, ({ session }) => {
    const now = new Date().toISOString();
    const screenplay = requireScreenplayDocument(session);
    const shotListRow = requireSceneShotListForScene({
      session,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
    });
    const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    const normalizedRailInputs = normalizeRailGroupInputs({
      shots: shotList.shots,
      railGroups: input.railGroups,
    });
    const productionGroups = (shotList.videoTakeProductionGroups ?? []).filter(
      (group) => group.shotIds.length > 0
    );
    const productionGroupsById = new Map(
      productionGroups.map((group) => [group.productionGroupId, group])
    );
    const nextProductionGroupsById = new Map<
      string,
      ShotVideoTakeProductionGroup
    >();
    const nextRailGroups: ShotVideoTakeRailGroup[] = [];
    const requestedRailShotIds = new Set<string>();

    normalizedRailInputs.forEach((railGroup) => {
      railGroup.shotIds.forEach((shotId) => requestedRailShotIds.add(shotId));
      const existingGroup = railGroup.productionGroupId
        ? productionGroupsById.get(railGroup.productionGroupId)
        : undefined;
      if (railGroup.productionGroupId && !existingGroup) {
        throw new ProjectDataError(
          'PROJECT_DATA413',
          `Shot video take rail group references an unknown production group: ${railGroup.productionGroupId}.`
        );
      }
      const sourceGroup = resolveRailGroupSource({
        railGroup,
        existingGroup,
        productionGroupsById,
      });
      const productionGroupId =
        existingGroup?.productionGroupId ?? ids('scene_shot_video_take_group');
      const videoTakeProduction = sourceGroup
        ? carryProductionPlanForShotMembership({
            plan: sourceGroup.videoTakeProduction,
            previousShotIds: sourceGroup.shotIds,
            nextShotIds: railGroup.shotIds,
          })
        : {};
      const productionGroup = {
        productionGroupId,
        shotIds: railGroup.shotIds,
        videoTakeProduction,
      };
      nextProductionGroupsById.set(productionGroupId, productionGroup);
      nextRailGroups.push({
        productionGroupId,
        shotIds: railGroup.shotIds,
      });
    });

    addSingleShotProductionGroupsForClearedRailShots({
      oldRailGroups: shotList.videoTakeRailGroups ?? [],
      productionGroupsById,
      requestedRailShotIds,
      nextProductionGroupsById,
      allocateProductionGroupId: () => ids('scene_shot_video_take_group'),
    });
    keepUnchangedSingleShotProductionGroups({
      productionGroups,
      requestedRailShotIds,
      nextProductionGroupsById,
    });

    const updatedShotList = {
      ...shotList,
      videoTakeRailGroups: nextRailGroups,
      videoTakeProductionGroups: orderProductionGroupsForShotList(
        shotList.shots,
        [...nextProductionGroupsById.values()]
      ),
    };
    updateSceneShotListRecordDocument({
      session,
      id: input.shotListId,
      document: updatedShotList,
      screenplay,
      now,
    });
    return {
      railGroups: nextRailGroups,
      resourceKeys: [
        `scene:${input.sceneId}`,
        `surface:scene:${input.sceneId}:shots`,
        `scene-shot-list:${input.shotListId}:video-take-rail-groups`,
        `scene-shot-list:${input.shotListId}:video-take-production`,
      ],
    };
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
  const inputModeId = context.productionGroup.videoTakeProduction.inputModeId ?? context.defaults.inputModeId;
  const modelChoice =
    context.productionGroup.videoTakeProduction.modelChoice ??
    defaultModelChoiceForInputMode(inputModeId);
  const preparedInputs = await withShotProjectSession(input, ({ session }) =>
    preparedInputsForContext(context, session, issues)
  );
  const missingRouteInputLabels = missingRequiredRouteInputLabelsForPreparedInputs({
    context,
    inputModeId,
    modelChoice,
    preparedInputs,
  });
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
  const plan = await planShotVideoTakeProduction(input);
  const inputsToCreate = inputsToCreateFromDependencyInventory(plan.dependencyInventory);
  const inputPlanItems = buildShotVideoTakePreflightInputItems({
    context,
    preparedInputs,
    availableInputs: context.availableInputs,
    inputsToCreate,
    plan,
  });
  return {
    valid: plan.diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    issues: plan.diagnostics,
    plan,
    target: context.target,
    productionGroup: context.productionGroup,
    inputModeId,
    shotGroupMode: context.shotGroupMode,
    modelChoice,
    preparedInputs,
    availableInputs: context.availableInputs,
    inputsToCreate,
    inputPlanItems,
    prompts,
    finalTake: {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      canCreateSpec: missingRouteInputLabels.length === 0 &&
        plan.diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
      title: finalDraft?.title ?? `${context.scene.title} video take`,
    },
    agentBrief: agentBrief(context),
    estimate: plan.finalEstimate,
  };
}

export async function estimateShotVideoTakeProduction(
  input: PreviewShotVideoTakeProductionInput
): Promise<ShotVideoTakeProductionEstimateReport> {
  const plan = await planShotVideoTakeProduction(input);
  const reportContext = await shotVideoTakePlanReportContext(input);
  return {
    target: reportContext.target,
    productionGroup: reportContext.productionGroup,
    inputModeId: plan.request.inputMode,
    shotGroupMode: plan.request.shotGroupMode,
    modelChoice: plan.request.modelChoice,
    estimate: plan.finalEstimate,
    plan,
    issues: plan.diagnostics,
  };
}

async function shotVideoTakePlanReportContext(
  input: PreviewShotVideoTakeProductionInput
): Promise<Pick<ShotVideoTakeGenerationContext, 'target' | 'productionGroup'>> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      production: input.production,
      persist: false,
    });
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    return { target: context.target, productionGroup: context.productionGroup };
  });
}

export async function planShotVideoTakeProduction(
  input: PlanShotVideoTakeProductionInput
): Promise<ShotVideoTakeGenerationPlan> {
  const context = await withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      production: input.production,
      persist: false,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
  const diagnostics = validatePreflight(context);
  const inputModeId = context.productionGroup.videoTakeProduction.inputModeId ?? context.defaults.inputModeId;
  const modelChoice =
    context.productionGroup.videoTakeProduction.modelChoice ??
    defaultModelChoiceForInputMode(inputModeId);
  const route = requireShotVideoTakeRoute(modelChoice, inputModeId, context.shotGroupMode);
  const family = SHOT_VIDEO_MODEL_FAMILIES.find((candidate) => candidate.choice === modelChoice);
  if (!family) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      `Shot video take model does not exist: ${modelChoice}.`
    );
  }
  const normalizedSettings = normalizeRouteSettingsForContext({
    context,
    route,
  });
  normalizedSettings.droppedSettingIds.forEach((settingId) => {
    diagnostics.push(
      createDiagnosticWarning(
        'CORE_SHOT_VIDEO_PLAN_STALE_SETTING_DROPPED',
        `Shot video take setting is not supported by the selected route and was ignored: ${settingId}.`,
        { path: ['productionGroup', 'videoTakeProduction', 'parameterValues', settingId] },
        'Review Run Setup after switching model or input mode.'
      )
    );
  });
  normalizedSettings.invalidSettingIds.forEach((settingId) => {
    diagnostics.push(
      issue(
        'CORE_SHOT_VIDEO_PLAN_INVALID_SETTING',
        `Shot video take setting is invalid for the selected route: ${settingId}.`,
        ['productionGroup', 'videoTakeProduction', 'parameterValues', settingId],
        'Choose one of the values supported by the selected route.'
      )
    );
  });
  const inputPolicy = input.inputPolicy ?? { defaultMode: 'auto' as const };
  const { dependencyInventory } = await withShotProjectSession(
    input,
    async ({ session }) => {
      const preparedInputs = preparedInputsForContext(context, session, diagnostics);
      const dependencyInventory = await buildShotVideoTakeDependencyInventory({
        session,
        context,
        inputModeId,
        modelChoice,
        route,
        normalizedSettings: normalizedSettings.values,
        preparedInputs,
        inputPolicy,
        diagnostics,
        projectName: input.projectName,
        homeDir: input.homeDir,
      });
      return { preparedInputs, dependencyInventory };
    }
  );
  const lines = planLinesFromDependencyInventory(dependencyInventory);
  const finalEstimate = finalEstimateFromDependencyInventory(dependencyInventory);
  return {
    planId: shotVideoTakePlanId({
      targetId: context.target.id,
      inputModeId,
      modelChoice,
      settings: normalizedSettings.values,
      inputPolicy,
    }),
    request: {
      projectId: context.project.id ?? context.project.name,
      sceneId: context.scene.id,
      shotListId: context.shotList.id,
      productionGroupId: context.productionGroup.productionGroupId,
      inputMode: inputModeId,
      shotGroupMode: context.shotGroupMode,
      modelChoice,
      routeSettings: normalizedSettings.values,
      inputPolicy,
    },
    model: {
      choice: family.choice,
      label: modelFamilyLabel(family),
      version: family.version,
      provider: family.provider,
    },
    route: {
      inputMode: route.inputMode,
      shotGroupMode: route.shotGroupMode,
      providerModel: route.providerModel,
      mode: route.mode,
      inputRoles: inputRolesForRoute(route.inputSlots),
      parameters: parametersForRoute(route),
    },
    dependencyInventory,
    lines,
    estimate: {
      state: dependencyInventory.estimate.state,
      estimatedTotalUsd: dependencyInventory.estimate.estimatedTotalUsd,
      pricedLineCount: dependencyInventory.estimate.pricedDependencyCount,
      unpricedLineCount: dependencyInventory.estimate.unpricedDependencyCount,
      missingLineCount: dependencyInventory.estimate.unavailableDependencyCount,
      requiresPriceOverride: dependencyInventory.estimate.requiresPriceOverride,
    },
    diagnostics: dependencyInventory.diagnostics,
    finalEstimate,
  };
}

export async function readShotVideoTakeProductionPlan(
  input: PlanShotVideoTakeProductionInput
): Promise<ShotVideoTakeProductionPlanReport> {
  const plan = await planShotVideoTakeProduction(input);
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({
      session,
      input,
      now,
      production: input.production,
      persist: false,
    });
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    return buildShotVideoTakeProductionPlanReport({
      session,
      context,
      plan,
    });
  });
}

function buildShotVideoTakeProductionPlanReport(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakeProductionPlanReport {
  const screenplay = requireScreenplayDocument(input.session);
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.context.scene.id,
    shotListId: input.context.shotList.id,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  const narrativeScope = sceneNarrativeReferenceScope({
    session: input.session,
    screenplay,
    sceneId: input.context.scene.id,
  });
  const scope = sceneShotReferenceScope({
    screenplay,
    narrativeScope,
    shotList,
  });
  const referenceSections = buildShotVideoTakeReferenceSections({
    session: input.session,
    context: input.context,
    plan: input.plan,
    narrativeScope,
    scope,
  });
  const diagnostics = [
    ...input.plan.diagnostics,
    ...referenceSections.diagnostics,
  ];
  return {
    target: input.context.target,
    productionGroup: input.context.productionGroup,
    finalPrompt:
      input.context.productionGroup.videoTakeProduction.agentProposal
        ?.finalPromptDraft ?? null,
    plan: input.plan,
    references: referenceSections.references,
    diagnostics,
  };
}

type SceneReferenceScope = {
  castMembers: NonNullable<ReturnType<typeof requireScreenplayDocument>['cast']>;
  locations: NonNullable<ReturnType<typeof requireScreenplayDocument>['locations']>;
};

function sceneNarrativeReferenceScope(input: {
  session: DatabaseSession;
  screenplay: ReturnType<typeof requireScreenplayDocument>;
  sceneId: string;
}): SceneReferenceScope {
  const hierarchy = requireSceneHierarchy(input.screenplay, input.sceneId);
  const castMemberIds: string[] = [];
  const locationIds: string[] = [];
  addOrderedIds(locationIds, hierarchy.scene.setting.locationIds ?? []);
  addOrderedIds(locationIds, sceneLocationIds(input.session, input.sceneId));
  hierarchy.scene.blocks.forEach((block) => {
    if ('castMemberId' in block && block.castMemberId) {
      addOrderedIds(castMemberIds, [block.castMemberId]);
    }
    addOrderedIds(castMemberIds, block.castMemberIds ?? []);
    addOrderedIds(locationIds, block.locationIds ?? []);
  });
  return {
    castMembers: orderedScreenplayItems(input.screenplay.cast, castMemberIds),
    locations: orderedScreenplayItems(input.screenplay.locations, locationIds),
  };
}

function sceneShotReferenceScope(input: {
  screenplay: ReturnType<typeof requireScreenplayDocument>;
  narrativeScope: SceneReferenceScope;
  shotList: ReturnType<typeof readSceneShotListDocument>;
}): SceneReferenceScope {
  const castMemberIds: string[] = [];
  const locationIds: string[] = [];
  addOrderedIds(
    castMemberIds,
    input.narrativeScope.castMembers.flatMap((castMember) =>
      castMember.id ? [castMember.id] : []
    )
  );
  addOrderedIds(
    locationIds,
    input.narrativeScope.locations.flatMap((location) =>
      location.id ? [location.id] : []
    )
  );
  input.shotList.shots.forEach((shot) => {
    addOrderedIds(castMemberIds, shot.castMemberIds);
    addOrderedIds(castMemberIds, shot.shotSpecs?.castReferences?.castMemberIds ?? []);
    addOrderedIds(locationIds, shot.locationIds);
    if (shot.shotSpecs?.location?.locationId) {
      addOrderedIds(locationIds, [shot.shotSpecs.location.locationId]);
    }
  });
  return {
    castMembers: orderedScreenplayItems(input.screenplay.cast, castMemberIds),
    locations: orderedScreenplayItems(input.screenplay.locations, locationIds),
  };
}

function sceneLocationIds(session: DatabaseSession, sceneId: string): string[] {
  return session.db
    .select({ locationId: sceneLocations.locationId })
    .from(sceneLocations)
    .where(eq(sceneLocations.sceneId, sceneId))
    .orderBy(asc(sceneLocations.position))
    .all()
    .map((row) => row.locationId);
}

function orderedScreenplayItems<T extends { id?: string }>(
  items: T[],
  orderedIds: string[]
): T[] {
  const byId = new Map(items.flatMap((item) => (item.id ? [[item.id, item]] : [])));
  const seen = new Set<string>();
  const ordered = orderedIds.flatMap((id) => {
    const item = byId.get(id);
    if (!item || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [item];
  });
  return ordered;
}

function addOrderedIds(target: string[], ids: string[]): void {
  const seen = new Set(target);
  ids.forEach((id) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      target.push(id);
    }
  });
}

function selectedCastIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(
    shots.flatMap(
      (shot) => shot.shotSpecs?.castReferences?.castMemberIds ?? shot.castMemberIds
    )
  );
}

function selectedNarrativeCastIdsForShots(input: {
  shots: SceneShot[];
  narrativeScope: SceneReferenceScope;
}): string[] {
  const narrativeCastMemberIds = new Set(
    input.narrativeScope.castMembers.flatMap((castMember) =>
      castMember.id ? [castMember.id] : []
    )
  );
  return [...selectedCastIdsForShots(input.shots)].filter((castMemberId) =>
    narrativeCastMemberIds.has(castMemberId)
  );
}

function selectedLocationIdsForShots(shots: SceneShot[]): Set<string> {
  const selected = new Set<string>();
  shots.forEach((shot) => {
    shot.locationIds.forEach((locationId) => selected.add(locationId));
    if (shot.shotSpecs?.location?.locationId) {
      selected.add(shot.shotSpecs.location.locationId);
    }
  });
  return selected;
}

function selectedLookbookSheetIdsForShots(shots: SceneShot[]): Set<string> {
  const selected = new Set<string>();
  for (const shot of shots) {
    const lookbookSheetId = shot.shotSpecs?.lookbookReference?.lookbookSheetId;
    if (lookbookSheetId) {
      selected.add(lookbookSheetId);
    }
  }
  return selected;
}

async function buildShotVideoTakeDependencyInventory(input: {
  session: DatabaseSession;
  projectName?: string;
  homeDir?: string;
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  route: ShotVideoRoute;
  normalizedSettings: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
  preparedInputs: ShotVideoTakePreflightInput[];
  inputPolicy: ShotVideoTakeInputPolicy;
  diagnostics: DiagnosticIssue[];
}): Promise<MediaGenerationDependencyInventory> {
  const requiredSlots = shotVideoTakeDependencySlotsForContext({
    context: input.context,
    inputModeId: input.inputModeId,
    route: input.route,
    includeReferenceContext: true,
  });
  const requiredSlotsByDependencyId = new Map(
    requiredSlots.map((slot) => [slot.dependencyId, slot])
  );
  const finalLineId = 'root:shot.video-take';
  const finalInputs: ShotVideoTakePreflightInput[] = [...input.preparedInputs];
  const result = await planMediaGenerationDependencyInventory({
    projectName: input.projectName,
    homeDir: input.homeDir,
    rootPurpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    rootTarget: input.context.target,
    rootLineId: finalLineId,
    rootLabel: 'Final video take',
    rootMediaKind: 'video',
    request: {
      kind: 'shot-video-take',
      context: input.context,
    } satisfies ShotVideoTakeDependencyRequest,
    slots: requiredSlots,
    diagnostics: input.diagnostics,
    inputPolicyMode: (dependencyId) => inputPolicyMode(input.inputPolicy, dependencyId),
    resolveSelection: async (slot) => {
      if (slot.selector.kind !== 'shot-video-input') {
        return resolveMediaGenerationDependencySelection({
          request: {
            kind: 'shot-video-take',
            context: input.context,
          } satisfies ShotVideoTakeDependencyRequest,
          session: input.session,
          slot,
        });
      }
      const requiredSlot = requiredSlotsByDependencyId.get(slot.dependencyId);
      if (!requiredSlot) {
        return { state: 'missing', asset: null, diagnostics: [] };
      }
      const prepared = input.preparedInputs.find((candidate) =>
        preparedInputMatchesSlot(candidate, requiredSlot)
      );
      return prepared
        ? {
            state: 'satisfied',
            asset: {
              assetId: prepared.assetId,
              assetFileId: prepared.assetFileId,
              projectRelativePath: prepared.projectRelativePath,
            },
            diagnostics: [],
          }
        : { state: 'missing', asset: null, diagnostics: [] };
    },
    declareDependencies: async ({ purpose }) =>
      isShotInputPurpose(purpose)
        ? shotVideoTakeReferenceDependencySlotsForContext(input.context)
        : [],
    estimateRoot: async (): Promise<MediaGenerationDependencyRootEstimate> => {
      const finalPricing = await estimateFinalPlanLine({
        context: input.context,
        inputModeId: input.inputModeId,
        modelChoice: input.modelChoice,
        normalizedSettings: input.normalizedSettings,
        preparedInputs: finalInputs,
        diagnostics: input.diagnostics,
      });
      return finalPricing;
    },
  });
  const dependencyInventory: MediaGenerationDependencyInventory & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  } = result.dependencyInventory;
  dependencyInventory.finalEstimate = result.rootEstimate;
  return dependencyInventory;
}

function shotVideoTakeDependencySlotsForContext(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  route: ShotVideoRoute;
  includeReferenceContext: boolean;
}): MediaGenerationDependencySlot[] {
  const slots = declareShotVideoTakeDependencySlots({
    target: input.context.target,
    inputModeId: input.inputModeId,
    selectedCast: input.context.referencedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
    })),
    selectedLocations: input.context.referencedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: input.context.activeLookbook
      ? {
          id: input.context.activeLookbook.id,
          name: input.context.activeLookbook.name,
          selectedSheetId:
            [...selectedLookbookSheetIdsForShots(input.context.shots)][0] ?? null,
        }
      : null,
    customReferenceInputs: [],
    requestedInputs: input.context.productionGroup.videoTakeProduction.requestedInputs,
    requiresMultiShotStoryboardSheet: input.route.inputSlots.some(
      (slot) => slot.kind === 'multi-shot-storyboard-sheet'
    ),
  });
  if (input.includeReferenceContext) {
    return slots;
  }
  return slots.filter((slot) => slot.selector.kind === 'shot-video-input');
}

function shotVideoTakeReferenceDependencySlotsForContext(
  context: ShotVideoTakeGenerationContext
): MediaGenerationDependencySlot[] {
  return declareShotVideoTakeDependencySlots({
    target: context.target,
    inputModeId: 'text-only',
    selectedCast: context.referencedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
    })),
    selectedLocations: context.referencedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: context.activeLookbook
      ? {
          id: context.activeLookbook.id,
          name: context.activeLookbook.name,
          selectedSheetId: [...selectedLookbookSheetIdsForShots(context.shots)][0] ?? null,
        }
      : null,
    customReferenceInputs: [],
    requestedInputs: [],
  });
}

export async function declareShotVideoTakeDependencies(
  input: MediaGenerationDependencyDeclarationInput
): Promise<MediaGenerationDependencySlot[]> {
  if (input.target.kind !== 'sceneShotGroup') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_TARGET_INVALID',
      `shot.video-take dependencies require a sceneShotGroup target. Received: ${input.target.kind}.`
    );
  }
  if (input.request.kind !== 'media-generation-spec') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_REQUEST_INVALID',
      `shot.video-take dependencies require a media-generation-spec request. Received: ${input.request.kind}.`
    );
  }
  const spec = input.request.spec as ShotVideoTakeGenerationSpec | undefined;
  if (spec?.purpose !== SHOT_VIDEO_TAKE_GENERATION_PURPOSE) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_DEPENDENCY_DECLARATION_SPEC_INVALID',
      'shot.video-take dependencies require a shot.video-take generation spec.'
    );
  }
  const context = await buildShotVideoTakeContext({
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: input.target.sceneId,
    shotListId: input.target.shotListId,
    shotIds: input.target.shotIds,
    ...(input.target.productionGroupId
      ? { productionGroupId: input.target.productionGroupId }
      : {}),
  });
  return declareShotVideoTakeDependencySlots({
    target: context.target,
    inputModeId: spec.inputModeId,
    selectedCast: context.referencedCast.map((castMember) => ({
      id: castMember.id,
      name: castMember.name,
    })),
    selectedLocations: context.referencedLocations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
    activeLookbook: context.activeLookbook
      ? {
          id: context.activeLookbook.id,
          name: context.activeLookbook.name,
          selectedSheetId: [...selectedLookbookSheetIdsForShots(context.shots)][0] ?? null,
        }
      : null,
    customReferenceInputs: spec.inputs
      .filter((generationInput) => generationInput.kind === 'reference-image')
      .map((generationInput) => ({
        id: generationInput.subjectId ?? generationInput.assetId,
        title: generationInput.role || 'Reference image',
      })),
  });
}

function finalEstimateFromDependencyInventory(
  dependencyInventory: MediaGenerationDependencyInventory
): ShotVideoTakePreflightReport['estimate'] {
  return (dependencyInventory as MediaGenerationDependencyInventory & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  }).finalEstimate ?? null;
}

async function estimateFinalPlanLine(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  normalizedSettings: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
  preparedInputs: ShotVideoTakePreflightInput[];
  diagnostics: DiagnosticIssue[];
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
  estimate: ShotVideoTakePreflightReport['estimate'];
}> {
  try {
    const spec = finalTakeSpecForPreflight({
      context: input.context,
      inputModeId: input.inputModeId,
      modelChoice: input.modelChoice,
      preparedInputs: input.preparedInputs,
      parameterValues: input.normalizedSettings,
      promptMode: 'estimate-placeholder',
    });
    validateFinalPricingSpecAgainstContext(spec, input.context);
    const plan = buildShotVideoTakePricingProviderPayload({
      spec,
      context: input.context,
    });
    const { estimateGeneration } = await import('@gorenku/studio-engines');
    const estimate = await estimateGeneration(toGenerationRequest(plan, spec));
    if (estimate.estimatedCostUsd === null) {
      return {
        pricing: {
          state: 'unpriced',
          estimatedUsd: null,
          reason: estimate.warnings.join(' ') || 'No pricing is configured for the final video route.',
          overrideRequired: true,
        },
        diagnostics: [
          issue(
            'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
            'Final video generation is unpriced.',
            ['dependencyInventory', 'rootGeneration'],
            'Approve an explicit unpriced-cost override before running.'
          ),
        ],
        estimate,
      };
    }
    return {
      pricing: { state: 'priced', estimatedUsd: estimate.estimatedCostUsd },
      diagnostics: [],
      estimate,
    };
  } catch (error) {
    const message = error instanceof Error
      ? `Final video estimate failed: ${error.message}`
      : 'Final video estimate failed.';
    const diagnostic = issue(
      'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
      message,
      ['dependencyInventory', 'rootGeneration'],
      'Review the selected model, route settings, and prepared inputs.'
    );
    input.diagnostics.push(diagnostic);
    return {
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: message,
        overrideRequired: true,
      },
      diagnostics: [diagnostic],
      estimate: null,
    };
  }
}

export async function buildShotInputDependencyDraftSpec(
  input: MediaGenerationDependencyDraftSpecInput
): Promise<MediaGenerationDependencyDraftSpec> {
  if (input.dependencyTarget.kind !== 'sceneShotGroup') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `Shot input dependency requires a sceneShotGroup target. Received: ${input.dependencyTarget.kind}.`
    );
  }
  if (input.request.kind !== 'shot-video-take') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `Shot input dependency requires a shot-video-take request. Received: ${input.request.kind}.`
    );
  }
  const request = input.request as unknown as ShotVideoTakeDependencyRequest;
  const purpose = shotInputPurposeForDependencyKind(input.dependencyKind);
  const outputInputKind = PURPOSE_CONFIG[purpose].outputInputKind;
  const draft =
    request.context.productionGroup.videoTakeProduction.agentProposal?.dependencyDrafts.find(
      (candidate) =>
        candidate.purpose === purpose &&
        candidate.outputInputKind === outputInputKind
    );
  if (!isAuthoredShotDependencyDraft(draft)) {
    return {
      purpose,
      spec: {
        purpose,
        target: input.dependencyTarget,
        dependencyKind: dependencyKindForPurpose(purpose),
        outputInputKind,
        modelChoice: request.context.defaults.imageDependencyModelChoice,
        prompt: estimateOnlyShotInputPrompt(input.label),
        parameterValues: defaultShotInputParameterValues(),
        title: input.label,
      },
      materializationState: 'needs-authored-draft',
      materializationReason:
        'Author a concrete dependency draft before generating this shot input.',
    };
  }
  return {
    purpose,
    spec: {
      purpose,
      target: input.dependencyTarget,
      dependencyKind: dependencyKindForPurpose(purpose),
      outputInputKind,
      modelChoice:
        draft.modelChoice ?? request.context.defaults.imageDependencyModelChoice,
      prompt: draft.prompt,
      parameterValues: draft.parameterValues ?? defaultShotInputParameterValues(),
      title: draft.title ?? input.label,
    },
    materializationState: 'generatable',
  };
}

function estimateOnlyShotInputPrompt(label: string): string {
  return [
    `Estimate placeholder for ${label}.`,
    'This draft is used only for pricing; an authored prompt is required before generation.',
  ].join(' ');
}

export interface ShotVideoTakeDependencyRequest {
  kind: 'shot-video-take';
  context: ShotVideoTakeGenerationContext;
}

function shotInputPurposeForDependencyKind(
  dependencyKind: MediaGenerationDependencyKind
): ShotVideoTakeInputGenerationPurpose {
  if (dependencyKind === 'first-frame') {
    return SHOT_FIRST_FRAME_GENERATION_PURPOSE;
  }
  if (dependencyKind === 'last-frame') {
    return SHOT_LAST_FRAME_GENERATION_PURPOSE;
  }
  if (dependencyKind === 'reference-image') {
    return SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE;
  }
  if (dependencyKind === 'multi-shot-storyboard-sheet') {
    return SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE;
  }
  throw new ProjectDataError(
    'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
    `Unsupported shot input dependency kind: ${dependencyKind}.`
  );
}

function isAuthoredShotDependencyDraft(
  draft: NonNullable<ShotVideoTakeProductionPlan['agentProposal']>['dependencyDrafts'][number] | undefined
): draft is NonNullable<ShotVideoTakeProductionPlan['agentProposal']>['dependencyDrafts'][number] {
  if (!draft?.prompt.trim()) {
    return false;
  }
  if (
    draft.purpose === SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE &&
    !draft.title?.trim()
  ) {
    return false;
  }
  return true;
}

function defaultShotInputParameterValues(): NonNullable<ShotVideoTakeProductionPlan['parameterValues']> {
  return {
    image_size: { width: 1024, height: 768 },
    quality: 'low',
  };
}

function dependencyKindForPurpose(
  purpose: ShotVideoTakeInputGenerationPurpose
): ShotVideoTakeInputGenerationSpec['dependencyKind'] {
  return PURPOSE_CONFIG[purpose].dependencyKind;
}

function inputPolicyMode(
  policy: ShotVideoTakeInputPolicy,
  slotKey: string
): 'reuse-selected' | 'regenerate' | 'auto' {
  return policy.slotModes?.[slotKey] ?? policy.defaultMode;
}

function normalizeRouteSettingsForContext(input: {
  context: ShotVideoTakeGenerationContext;
  route: ShotVideoRoute;
}) {
  return normalizeShotVideoRouteSettings({
    route: input.route,
    defaults: input.context.defaults.parameterValues,
    settings: input.context.productionGroup.videoTakeProduction.parameterValues,
  }) as {
    values: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
    providerValues: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
    droppedSettingIds: string[];
    invalidSettingIds: string[];
  };
}

function modelFamilyLabel(
  family: (typeof SHOT_VIDEO_MODEL_FAMILIES)[number]
): string {
  return family.version ? `${family.label} ${family.version}` : family.label;
}

function inputRolesForRoute(
  inputSlots: ShotVideoRouteInputSlot[]
): ShotVideoTakeModelChoiceReport['inputRoles'] {
  return inputSlots.map((slot) => ({
    kind: slot.kind,
    required: slot.required,
    minCount: slot.minCount,
    maxCount: slot.maxCount,
    mediaKind: slot.mediaKind,
  }));
}

function parametersForRoute(
  route: ShotVideoRoute
): ShotVideoTakeModelChoiceReport['parameters'] {
  return route.parameters.map((parameter) => ({
    name: parameter.id,
    label: parameter.label,
    required: parameter.required,
    ...(parameter.defaultValue !== undefined ? { defaultValue: parameter.defaultValue } : {}),
    ...(parameter.allowedValues ? { allowedValues: parameter.allowedValues } : {}),
    ...(parameter.minimum !== undefined ? { minimum: parameter.minimum } : {}),
    ...(parameter.maximum !== undefined ? { maximum: parameter.maximum } : {}),
  }));
}

function durationSupportForRoute(
  route: ShotVideoRoute
): ShotVideoTakeModelChoiceReport['duration'] {
  if (!route.duration) {
    return { supported: false };
  }
  const durationParameter = route.parameters.find((parameter) => parameter.id === 'duration');
  const defaultValue = durationSeconds(durationParameter?.defaultValue);
  if (route.duration.kind === 'continuous') {
    return {
      supported: true,
      minimum: route.duration.minSeconds,
      maximum: route.duration.maxSeconds,
      ...(defaultValue !== null ? { default: defaultValue } : {}),
    };
  }
  return {
    supported: true,
    values: route.duration.valuesSeconds,
    ...(defaultValue !== null ? { default: defaultValue } : {}),
  };
}

function shotVideoTakePlanId(input: {
  targetId: string;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  settings: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
  inputPolicy: ShotVideoTakeInputPolicy;
}): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);
  return `shot_video_take_plan_${hash}`;
}

const SHOT_VIDEO_TAKE_INPUT_KIND_LABELS: Record<ShotVideoTakeInputKind, string> = {
  'first-frame': 'First frame',
  'last-frame': 'Last frame',
  'reference-image': 'Reference image',
  'character-sheet': 'Character sheet',
  'location-sheet': 'Location sheet',
  'lookbook-sheet': 'Lookbook sheet',
  'multi-shot-storyboard-sheet': 'Storyboard sheet',
  'source-video': 'Source video',
  audio: 'Audio',
};

function buildShotVideoTakePreflightInputItems(input: {
  context: ShotVideoTakeGenerationContext;
  preparedInputs: ShotVideoTakePreflightInput[];
  availableInputs: ShotVideoTakeAvailableInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakePreflightInputItem[] {
  const items: ShotVideoTakePreflightInputItem[] = [];

  const candidatesByDependencyId = new Map<string, ShotVideoTakeAvailableInput[]>();
  input.availableInputs.forEach((availableInput) => {
    const key = shotVideoInputDependencyId({
      kind: availableInput.kind,
      subjectKind: availableInput.subjectKind,
      subjectId: availableInput.subjectId,
    });
    candidatesByDependencyId.set(key, [
      ...(candidatesByDependencyId.get(key) ?? []),
      availableInput,
    ]);
  });

  input.plan.lines.forEach((line) => {
    if (line.kind === 'final-video-generation') {
      return;
    }
    const dependencyId = line.dependencyId;
    const candidates = dependencyId ? (candidatesByDependencyId.get(dependencyId) ?? []) : [];
    const selected = candidates.find((candidate) => candidate.selected);
    const prepared = dependencyId
      ? input.preparedInputs.find(
          (candidate) =>
            shotVideoInputDependencyId({
              kind: candidate.kind,
              subjectKind: candidate.subjectKind,
              subjectId: candidate.subjectId,
            }) === dependencyId
        )
      : undefined;
    const source = prepared ?? selected;
    items.push({
      key: line.id,
      title: inputItemTitle(input.context, line),
      caption: inputItemCaption(line),
      mediaKind: line.mediaKind as 'image' | 'audio' | 'video',
      status: itemStatusForLine(line, Boolean(selected)),
      ...(source
        ? {
            assetId: source.assetId,
            assetFileId: source.assetFileId,
            projectRelativePath: source.projectRelativePath,
          }
        : {}),
      planLineId: line.id,
      dependencyLineId: line.dependencyLineId,
      purpose: line.purpose,
      pricing: line.pricing,
      ...slotForPlanLine(line),
      candidates:
        candidates.length > 0
          ? candidates.map((candidate, index) => ({
              inputId: candidate.inputId,
              label: `${inputKindLabel(candidate.kind)} ${index + 1}`,
            }))
          : undefined,
      selectedInputId: selected?.inputId ?? null,
    });
  });

  return items;
}

function itemStatusForLine(
  line: MediaGenerationPlanLine,
  hasAvailableCandidate: boolean
): ShotVideoTakePreflightInputItem['status'] {
  if (line.kind === 'reused-asset') {
    return 'ready';
  }
  if (hasAvailableCandidate) {
    return 'available';
  }
  return 'needed';
}

function inputItemTitle(
  context: ShotVideoTakeGenerationContext,
  line: MediaGenerationPlanLine
): string {
  const target = dependencyTargetForLine(context, line);
  if (target?.kind === 'castMember') {
    return context.referencedCast.find((castMember) => castMember.id === target.id)?.name ??
      line.label;
  }
  if (target?.kind === 'location') {
    return context.referencedLocations.find((location) => location.id === target.id)?.name ??
      line.label;
  }
  if (target?.kind === 'lookbook') {
    return context.activeLookbook?.id === target.id ? context.activeLookbook.name : line.label;
  }
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  return inputKindLabel(parsed.ok ? parsed.value.kind : 'reference-image');
}

function inputItemCaption(line: MediaGenerationPlanLine): string {
  if (line.dependencyKind === 'cast-character-sheet') {
    return 'Character sheet';
  }
  if (line.dependencyKind === 'location-environment-sheet') {
    return 'Location sheet';
  }
  if (line.dependencyKind === 'lookbook-sheet') {
    return 'Lookbook sheet';
  }
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  if (parsed.ok) {
    return inputKindLabel(parsed.value.kind);
  }
  return line.label;
}

function slotForPlanLine(
  line: MediaGenerationPlanLine
): Pick<ShotVideoTakePreflightInputItem, 'slot'> {
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  if (!parsed.ok) {
    return {};
  }
  return {
    slot: {
      kind: parsed.value.kind,
      ...(parsed.value.subjectKind ? { subjectKind: parsed.value.subjectKind } : {}),
      ...(parsed.value.subjectId ? { subjectId: parsed.value.subjectId } : {}),
    },
  };
}

function dependencyTargetForLine(
  context: ShotVideoTakeGenerationContext,
  line: MediaGenerationPlanLine
): MediaGenerationDependencyLine['target'] {
  if (!line.dependencyId) {
    return null;
  }
  const parsed = parseShotVideoInputDependencyId(line.dependencyId);
  if (parsed.ok && parsed.value.subjectKind === 'cast-member' && parsed.value.subjectId) {
    return { kind: 'castMember', id: parsed.value.subjectId };
  }
  if (parsed.ok && parsed.value.subjectKind === 'location' && parsed.value.subjectId) {
    return { kind: 'location', id: parsed.value.subjectId };
  }
  if (parsed.ok && parsed.value.subjectKind === 'lookbook' && parsed.value.subjectId) {
    return { kind: 'lookbook', id: parsed.value.subjectId };
  }
  return context.target;
}

function inputKindLabel(kind: ShotVideoTakeInputKind): string {
  return SHOT_VIDEO_TAKE_INPUT_KIND_LABELS[kind] ?? kind;
}

function finalTakeSpecForPreflight(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  parameterValues?: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
  promptMode?: 'require-authored' | 'estimate-placeholder';
}): ShotVideoTakeGenerationSpec {
  const plan = input.context.productionGroup.videoTakeProduction;
  const finalDraft = plan.agentProposal?.finalPromptDraft;
  const prompt = finalDraft?.prompt.trim()
    ? finalDraft.prompt
    : input.promptMode === 'estimate-placeholder'
      ? 'Shot video take estimate placeholder.'
      : null;
  if (!prompt) {
    throw new ProjectDataError(
      'PROJECT_DATA415',
      'Shot video take final spec requires an authored final prompt draft.'
    );
  }
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: input.context.target,
    inputModeId: input.inputModeId,
    modelChoice: input.modelChoice,
    prompt,
    ...(finalDraft?.negativePrompt ? { negativePrompt: finalDraft.negativePrompt } : {}),
    parameterValues:
      input.parameterValues ??
      parameterValuesForFinalTake(input.context, input.inputModeId, input.modelChoice),
    inputs: input.preparedInputs.map((preparedInput) => ({
      kind: preparedInput.kind,
      assetId: preparedInput.assetId,
      assetFileId: preparedInput.assetFileId,
      role: preparedInput.role,
      mediaKind: preparedInput.mediaKind,
      projectRelativePath: preparedInput.projectRelativePath,
      ...(preparedInput.subjectKind ? { subjectKind: preparedInput.subjectKind } : {}),
      ...(preparedInput.subjectId ? { subjectId: preparedInput.subjectId } : {}),
    })),
    title: finalDraft?.title ?? `${input.context.scene.title} video take`,
  };
}

function parameterValuesForFinalTake(
  context: ShotVideoTakeGenerationContext,
  inputModeId: ShotVideoTakeInputModeId,
  modelChoice: ShotVideoTakeModelChoice
): NonNullable<ShotVideoTakeProductionPlan['parameterValues']> {
  const report = modelChoices(context, inputModeId).find((model) => model.modelChoice === modelChoice);
  if (!report) {
    return {};
  }
  const values: NonNullable<ShotVideoTakeProductionPlan['parameterValues']> = {};
  const planValues = context.productionGroup.videoTakeProduction.parameterValues ?? {};
  for (const parameter of report.parameters) {
    const contextDefault = context.defaults.parameterValues[parameter.name];
    if (parameter.defaultValue !== undefined) {
      values[parameter.name] = parameter.defaultValue;
    }
    if (contextDefault !== undefined) {
      values[parameter.name] = contextDefault;
    }
    if (planValues[parameter.name] !== undefined) {
      values[parameter.name] = planValues[parameter.name];
    }
    if (values[parameter.name] !== undefined) {
      values[parameter.name] = canonicalParameterValue(parameter, values[parameter.name]);
    }
  }
  return values;
}

function canonicalParameterValue(
  parameter: ShotVideoTakeModelChoiceReport['parameters'][number],
  value: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>[string]
): NonNullable<ShotVideoTakeProductionPlan['parameterValues']>[string] {
  if (!parameter.allowedValues?.length) {
    return value;
  }
  const exactMatch = parameter.allowedValues.find((allowed) => allowed === value);
  if (exactMatch !== undefined) {
    return exactMatch;
  }
  const stringMatch = parameter.allowedValues.find(
    (allowed) => String(allowed) === String(value)
  );
  if (stringMatch !== undefined) {
    return stringMatch;
  }
  const seconds = durationSeconds(value);
  if (seconds === null) {
    return value;
  }
  const durationMatch = parameter.allowedValues.find(
    (allowed) => durationSeconds(allowed) === seconds
  );
  return durationMatch ?? value;
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

export async function deleteShotVideoTakeInput(
  input: DeleteShotVideoTakeInputInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, async ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const prepared = prepareShotGroupInSession({ session, input, now });
    const deleting = requireShotVideoTakeInput(session, input.inputId);
    if (
      deleting.productionGroupId !== prepared.productionGroup.productionGroupId ||
      !sameShotIds(deleting.shotIds, prepared.orderedShotIds)
    ) {
      throw new ProjectDataError(
        'PROJECT_DATA362',
        'Shot video take input belongs to a different production group.'
      );
    }

    await deleteProjectRelativeFile(projectFolder, deleting.projectRelativePath);
    deleteShotVideoTakeInputRecord(session, input.inputId);

    if (deleting.selected) {
      const replacement = listShotVideoTakeInputRecords(session, {
        sceneId: input.sceneId,
        shotListId: input.shotListId,
        productionGroupId: prepared.productionGroup.productionGroupId,
        shotIds: prepared.orderedShotIds,
      }).find(
        (candidate) =>
          candidate.kind === deleting.kind &&
          candidate.subjectKind === deleting.subjectKind &&
          candidate.subjectId === deleting.subjectId
      );
      if (replacement) {
        const selected = selectShotVideoTakeInputRecord(session, {
          inputId: replacement.inputId,
          now,
        });
        updatePreparedInputSelection({
          session,
          prepared,
          now,
          input: selected,
          selected: true,
        });
      } else {
        updatePreparedInputSelection({
          session,
          prepared,
          now,
          input: deleting,
          selected: false,
        });
      }
    }

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
export const validateShotReferenceImageSpec = validateShotInputSpec;
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
export const createShotReferenceImageSpec = createShotInputSpec;
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
export const updateShotReferenceImageSpec = updateShotInputSpec;
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
export const readShotReferenceImageSpec = readShotSpec;
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
export const listShotReferenceImageSpecs = (input: ShotVideoTakeContextInput) =>
  listShotInputSpecs(input, SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE);
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

export async function prepareShotInputDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ShotVideoTakeInputGenerationSpec;
}): Promise<PreparedMediaGeneration> {
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
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
  };
}

export const prepareShotFirstFrameSpec = prepareShotInputSpec;
export const prepareShotLastFrameSpec = prepareShotInputSpec;
export const prepareShotReferenceImageSpec = prepareShotInputSpec;
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
export const estimateShotReferenceImageSpec = estimateShotInputSpec;
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
export const runShotReferenceImageSpec = runShotInputSpec;
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

export async function prepareShotVideoTakeDraftSpec(input: {
  projectName?: string;
  homeDir?: string;
  spec: ShotVideoTakeGenerationSpec;
}): Promise<PreparedMediaGeneration> {
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
  return {
    spec: draftMediaGenerationSpecRecord(normalized),
    providerPayload: plan.payload,
    generation: toGenerationRequest(plan, normalized),
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
export const importShotReferenceImage = (input: ImportShotVideoTakeInputMediaInput) =>
  importShotInputMedia(input, SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE);
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
    provider: 'fal-ai' | 'elevenlabs';
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
  context: ShotVideoTakeGenerationContext
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
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  for (const slot of route.inputSlots) {
    mapRouteInputSlot(spec, inputFiles, slot);
  }
  return {
    provider: 'fal-ai',
    model: route.providerModel,
    mode: route.mode,
    outputCount: 1,
    payload,
    inputFiles,
  };
}

function buildShotVideoTakePricingProviderPayload(input: {
  spec: ShotVideoTakeGenerationSpec;
  context: ShotVideoTakeGenerationContext;
}): ShotVideoTakeProviderPlan {
  const { spec, context } = input;
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  const payload: Record<string, unknown> = {
    prompt: spec.prompt,
    ...spec.parameterValues,
  };
  if (spec.negativePrompt) {
    payload.negative_prompt = spec.negativePrompt;
  }
  return {
    provider: 'fal-ai',
    model: route.providerModel,
    mode: route.mode,
    outputCount: 1,
    payload,
    inputFiles: [],
    pricingInputCounts: finalVideoPricingInputCounts({ spec, context }),
  };
}

function finalVideoPricingInputCounts(input: {
  spec: ShotVideoTakeGenerationSpec;
  context: ShotVideoTakeGenerationContext;
}): ShotVideoTakeProviderPlan['pricingInputCounts'] {
  const route = requireShotVideoTakeRoute(
    input.spec.modelChoice,
    input.spec.inputModeId,
    input.context.shotGroupMode
  );
  const requiredImageInputCount = route.inputSlots.reduce(
    (count, slot) =>
      slot.required && slot.mediaKind === 'image'
        ? count + slot.minCount
        : count,
    0
  );
  const preparedImageInputCount = input.spec.inputs.filter(
    (candidate) =>
      candidate.mediaKind === 'image' &&
      route.inputSlots.some((slot) => finalInputMatchesRouteSlot(candidate, slot))
  ).length;
  const imageCount = Math.max(requiredImageInputCount, preparedImageInputCount);
  return imageCount > 0 ? { image: imageCount } : undefined;
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
      ...(plan.pricingInputCounts ? { pricingInputCounts: plan.pricingInputCounts } : {}),
      parameters,
      outputNames: [outputName(spec)],
    },
  };
}

function mapRouteInputSlot(
  spec: ShotVideoTakeGenerationSpec,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  slot: ShotVideoRouteInputSlot
): void {
  const matches = spec.inputs.filter((candidate) => finalInputMatchesRouteSlot(candidate, slot));
  if (slot.required && matches.length < slot.minCount) {
    throw new ProjectDataError(
      'PROJECT_DATA363',
      `Shot video take spec requires a prepared ${slot.kind} input.`
    );
  }
  matches.forEach((input) => {
    inputFiles.push({
      field: slot.providerField,
      projectRelativePath: input.projectRelativePath,
      mediaKind: input.mediaKind,
      asArray: slot.asArray,
      required: slot.required,
    });
  });
}

function finalInputMatchesRouteSlot(
  input: ShotVideoTakeGenerationSpec['inputs'][number],
  slot: ShotVideoRouteInputSlot
): boolean {
  if (input.kind === slot.kind) {
    return true;
  }
  return (
    slot.kind === 'reference-image' &&
    [
      'character-sheet',
      'location-sheet',
      'lookbook-sheet',
      'multi-shot-storyboard-sheet',
    ].includes(input.kind)
  );
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
  if (!spec.prompt.trim()) {
    throw new ProjectDataError(
      'PROJECT_DATA416',
      'Shot video take input spec requires an authored prompt.'
    );
  }
  if (
    spec.purpose === SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE &&
    !spec.title?.trim()
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA417',
      'shot.reference-image requires a title that names the reference intent.'
    );
  }
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
  validateFinalPricingSpecAgainstContext(spec, context);
  const missingInputs = missingRequiredRouteInputLabelsForFinalSpec({
    context,
    spec,
  });
  if (missingInputs.length > 0) {
    throw new ProjectDataError(
      'PROJECT_DATA384',
      `Shot video take spec is missing required input${
        missingInputs.length === 1 ? '' : 's'
      }: ${missingInputs.join(', ')}.`
    );
  }
}

function missingRequiredRouteInputLabelsForFinalSpec(input: {
  context: ShotVideoTakeGenerationContext;
  spec: ShotVideoTakeGenerationSpec;
}): string[] {
  const route = requireShotVideoTakeRoute(
    input.spec.modelChoice,
    input.spec.inputModeId,
    input.context.shotGroupMode
  );
  return route.inputSlots
    .filter((slot) => slot.required)
    .filter(
      (slot) =>
        input.spec.inputs.filter((candidate) =>
          finalInputMatchesRouteSlot(candidate, slot)
        ).length < slot.minCount
    )
    .map(routeInputSlotLabel);
}

function missingRequiredRouteInputLabelsForPreparedInputs(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
}): string[] {
  const route = requireShotVideoTakeRoute(
    input.modelChoice,
    input.inputModeId,
    input.context.shotGroupMode
  );
  return route.inputSlots
    .filter((slot) => slot.required)
    .filter(
      (slot) =>
        input.preparedInputs.filter((candidate) =>
          preparedInputMatchesRouteSlot(candidate, slot)
        ).length < slot.minCount
    )
    .map(routeInputSlotLabel);
}

function preparedInputMatchesRouteSlot(
  input: ShotVideoTakePreflightInput,
  slot: ShotVideoRouteInputSlot
): boolean {
  if (input.kind === slot.kind) {
    return true;
  }
  return (
    slot.kind === 'reference-image' &&
    [
      'character-sheet',
      'location-sheet',
      'lookbook-sheet',
      'multi-shot-storyboard-sheet',
    ].includes(input.kind)
  );
}

function routeInputSlotLabel(slot: ShotVideoRouteInputSlot): string {
  return slot.kind;
}

function validateFinalPricingSpecAgainstContext(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext
): void {
  if (!sameShotIds(spec.target.shotIds, context.target.shotIds)) {
    throw new ProjectDataError(
      'PROJECT_DATA370',
      'Shot video take spec targets a stale shot group.'
    );
  }
  const report = modelChoices(context, spec.inputModeId).find((model) => model.modelChoice === spec.modelChoice);
  if (!report || !report.available || !report.supportedInputModes.includes(spec.inputModeId)) {
    throw new ProjectDataError(
      'PROJECT_DATA371',
      'Shot video take model does not support the selected input mode for this shot group.'
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
  inputModeId?: ShotVideoTakeInputModeId
): ShotVideoTakeModelChoiceReport[] {
  const selectedInputMode = inputModeId ?? context.defaults.inputModeId;
  const models = SHOT_VIDEO_MODEL_FAMILIES.map((family) =>
    modelReport(family, selectedInputMode, context.shotGroupMode)
  );
  return models.map((model) => ({
    ...model,
    available: !inputModeId || model.supportedInputModes.includes(inputModeId),
    ...(!inputModeId || model.supportedInputModes.includes(inputModeId)
      ? {}
      : { unavailableReason: `This model does not support ${inputModeId}.` }),
  }));
}

function shotInputModelChoices(): ShotVideoTakeInputModelChoiceReport[] {
  return [
    {
      modelChoice: 'fal-ai/openai/gpt-image-2',
      label: 'GPT Image 2',
      available: true,
      mediaKind: 'image',
      defaultParameterValues: defaultShotInputParameterValues(),
      parameters: shotInputParameters(),
    },
    {
      modelChoice: 'fal-ai/nano-banana-2',
      label: 'Nano Banana 2',
      available: true,
      mediaKind: 'image',
      defaultParameterValues: defaultShotInputParameterValues(),
      parameters: shotInputParameters(),
    },
    {
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      label: 'Grok Imagine',
      available: true,
      mediaKind: 'image',
      defaultParameterValues: defaultShotInputParameterValues(),
      parameters: shotInputParameters(),
    },
  ];
}

function shotInputParameters(): ShotVideoTakeInputModelChoiceReport['parameters'] {
  return [
    {
      name: 'image_size',
      label: 'Image size',
      required: true,
      defaultValue: { width: 1024, height: 768 },
    },
    {
      name: 'quality',
      label: 'Quality',
      required: true,
      defaultValue: 'low',
      allowedValues: ['low', 'medium', 'high'],
    },
  ];
}

function modelReport(
  family: (typeof SHOT_VIDEO_MODEL_FAMILIES)[number],
  inputModeId: ShotVideoTakeInputModeId,
  shotGroupMode: ShotVideoTakeShotGroupMode
): ShotVideoTakeModelChoiceReport {
  const route = family.routes.find(
    (candidate) =>
      candidate.inputMode === inputModeId &&
      candidate.shotGroupMode === shotGroupMode
  );
  const supportedInputModes = [
    ...new Set(
      family.routes
        .filter((candidate) => candidate.shotGroupMode === shotGroupMode)
        .map((candidate) => candidate.inputMode)
    ),
  ];
  return {
    modelChoice: family.choice,
    label: modelFamilyLabel(family),
    available: Boolean(route),
    ...(!route ? { unavailableReason: `This model does not support ${inputModeId}.` } : {}),
    supportedInputModes,
    duration: route ? durationSupportForRoute(route) : { supported: false },
    inputRoles: route ? inputRolesForRoute(route.inputSlots) : [],
    parameters: route ? parametersForRoute(route) : [],
    estimateInputs: {
      canEstimateBeforeDependenciesExist:
        !route || route.inputSlots.filter((slot) => slot.required).length === 0,
      requiresPreparedInputs: Boolean(route?.inputSlots.some((slot) => slot.required)),
    },
  };
}

function durationSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d+)(?:s)?$/.exec(value);
  return match ? Number(match[1]) : null;
}

function validatePreflight(context: ShotVideoTakeGenerationContext): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const plan = context.productionGroup.videoTakeProduction;
  const inputModeId = plan.inputModeId ?? context.defaults.inputModeId;
  const modelChoice = plan.modelChoice ?? defaultModelChoiceForInputMode(inputModeId);
  const route = selectShotVideoRoute({
    modelChoice,
    inputMode: inputModeId,
    shotGroupMode: context.shotGroupMode,
  });
  if (!route) {
    issues.push(
      issue(
        'PROJECT_DATA375',
        'Shot video take model does not support the selected input mode for this shot group.',
        ['productionGroup', 'videoTakeProduction', 'inputModeId'],
        'Choose a model and input mode combination that supports the current shot group.'
      )
    );
  }
  if (plan.agentProposal) {
    if (plan.agentProposal.basedOnInputModeId !== inputModeId) {
      issues.push(
        issue(
          'PROJECT_DATA376',
          'Shot video take agent proposal is stale for the current input mode.',
          ['productionGroup', 'videoTakeProduction', 'agentProposal', 'basedOnInputModeId'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
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
    if (
      plan.agentProposal.basedOnShotIds &&
      !sameShotIds(plan.agentProposal.basedOnShotIds, context.productionGroup.shotIds)
    ) {
      issues.push(
        issue(
          'PROJECT_DATA378',
          'Shot video take agent proposal is stale for the current shot group.',
          ['productionGroup', 'videoTakeProduction', 'agentProposal', 'basedOnShotIds'],
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
  return [
    ...inputs.filter((input): input is ShotVideoTakePreflightInput => Boolean(input)),
    ...lookbookSheetInputsForContext(context, session, issues),
  ];
}

function lookbookSheetInputsForContext(
  context: ShotVideoTakeGenerationContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[]
): ShotVideoTakePreflightInput[] {
  if (!context.activeLookbook) {
    return [];
  }
  const selectedIds = selectedLookbookSheetIdsForShots(context.shots);
  if (selectedIds.size === 0) {
    const defaultSheet = listLookbookSheets(session, context.activeLookbook.id)[0];
    if (defaultSheet) {
      selectedIds.add(defaultSheet.id);
    }
  }
  return [...selectedIds]
    .map((sheetId) =>
      lookbookSheetInputForId(context, session, issues, sheetId)
    )
    .filter((input): input is ShotVideoTakePreflightInput => Boolean(input));
}

function lookbookSheetInputForId(
  context: ShotVideoTakeGenerationContext,
  session: DatabaseSession,
  issues: DiagnosticIssue[],
  sheetId: string
): ShotVideoTakePreflightInput | null {
  const record = readLookbookSheetRecord(session, sheetId);
  if (!record || record.lookbookId !== context.activeLookbook?.id) {
    issues.push(
      issue(
        'PROJECT_DATA412',
        'Selected lookbook sheet does not belong to the active lookbook.',
        ['shots', 'shotSpecs', 'lookbookReference', 'lookbookSheetId'],
        'Choose a lookbook sheet from the active lookbook.'
      )
    );
    return null;
  }
  const sheet = readLookbookSheet(session, sheetId);
  const file = sheet?.asset.files.find((candidate) => candidate.mediaKind === 'image');
  if (!sheet || !file) {
    issues.push(
      issue(
        'PROJECT_DATA413',
        'Selected lookbook sheet has no image file.',
        ['shots', 'shotSpecs', 'lookbookReference', 'lookbookSheetId'],
        'Regenerate or import a lookbook sheet with an image file.'
      )
    );
    return null;
  }
  return {
    kind: 'lookbook-sheet',
    assetId: sheet.asset.assetId,
    assetFileId: file.id,
    role: file.role,
    mediaKind: 'image',
    projectRelativePath: file.projectRelativePath,
    subjectKind: 'lookbook',
    subjectId: context.activeLookbook.id,
  };
}

function inputsToCreateFromDependencyInventory(
  inventory: MediaGenerationDependencyInventory
): ShotVideoTakePreflightDependency[] {
  return inventory.dependencies
    .filter(
      (line) =>
        line.availability.state === 'missing-generated' ||
        line.availability.state === 'missing-manual'
    )
    .map((line) => {
      const parsed = parseShotVideoInputDependencyId(line.dependencyId);
      const outputInputKind = parsed.ok ? parsed.value.kind : 'reference-image';
      return {
        dependencyId: line.dependencyId,
        dependencyKind: line.dependencyKind,
        ...(line.purpose ? { purpose: line.purpose } : {}),
        outputInputKind,
        ...(parsed.ok && parsed.value.subjectKind
          ? { subjectKind: parsed.value.subjectKind }
          : {}),
        ...(parsed.ok && parsed.value.subjectId
          ? { subjectId: parsed.value.subjectId }
          : {}),
        mediaKind: line.mediaKind as 'image' | 'audio' | 'video',
        required: line.required,
        reason: line.diagnostics[0]?.message ?? line.label,
      };
    });
}

function preparedInputMatchesSlot(
  input: ShotVideoTakePreflightInput,
  slot: MediaGenerationDependencySlot
): boolean {
  if (slot.selector.kind === 'shot-video-input') {
    return (
      input.kind === slot.selector.inputKind &&
      input.mediaKind === 'image' &&
      (!slot.selector.subjectKind ||
        input.subjectKind === slot.selector.subjectKind) &&
      (!slot.selector.subjectId || input.subjectId === slot.selector.subjectId)
    );
  }
  if (slot.selector.kind === 'asset-relationship') {
    if (
      slot.selector.target.kind === 'castMember' &&
      input.kind === 'character-sheet'
    ) {
      return (
        input.subjectKind === 'cast-member' &&
        input.subjectId === slot.selector.target.castMemberId
      );
    }
    if (
      slot.selector.target.kind === 'location' &&
      input.kind === 'location-sheet'
    ) {
      return (
        input.subjectKind === 'location' &&
        input.subjectId === slot.selector.target.locationId
      );
    }
    return false;
  }
  if (slot.selector.kind === 'lookbook-sheet') {
    return (
      input.kind === 'lookbook-sheet' &&
      input.subjectKind === 'lookbook' &&
      input.subjectId === slot.selector.lookbookId
    );
  }
  return false;
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

type NormalizedShotVideoTakeRailGroupInput =
  UpdateShotVideoTakeRailGroupsInput['railGroups'][number] & {
    shotIds: string[];
  };

function normalizeRailGroupInputs(input: {
  shots: SceneShot[];
  railGroups: UpdateShotVideoTakeRailGroupsInput['railGroups'];
}): NormalizedShotVideoTakeRailGroupInput[] {
  const assignedShotIds = new Map<string, number>();
  return input.railGroups.map((railGroup, railGroupIndex) => {
    const shotIds = normalizeShotIds(input.shots, railGroup.shotIds);
    shotIds.forEach((shotId) => {
      const existingRailGroupIndex = assignedShotIds.get(shotId);
      if (existingRailGroupIndex !== undefined) {
        throw new ProjectDataError(
          'PROJECT_DATA414',
          `Shot belongs to more than one video take rail group: ${shotId}.`,
          {
            suggestion: `Remove the shot from rail group ${existingRailGroupIndex + 1} or ${railGroupIndex + 1}.`,
          }
        );
      }
      assignedShotIds.set(shotId, railGroupIndex);
    });
    return {
      ...railGroup,
      shotIds,
    };
  });
}

function resolveRailGroupSource(input: {
  railGroup: NormalizedShotVideoTakeRailGroupInput;
  existingGroup?: ShotVideoTakeProductionGroup;
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
}): ShotVideoTakeProductionGroup | undefined {
  if (input.railGroup.mergePartnerProductionGroupId) {
    requireProductionGroupId(
      input.productionGroupsById,
      input.railGroup.mergePartnerProductionGroupId,
      'merge partner'
    );
  }
  if (input.existingGroup) {
    return input.existingGroup;
  }
  if (input.railGroup.sourceProductionGroupId) {
    return requireProductionGroupId(
      input.productionGroupsById,
      input.railGroup.sourceProductionGroupId,
      'source'
    );
  }
  return undefined;
}

function requireProductionGroupId(
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>,
  productionGroupId: string,
  role: 'source' | 'merge partner'
): ShotVideoTakeProductionGroup {
  const productionGroup = productionGroupsById.get(productionGroupId);
  if (!productionGroup) {
    throw new ProjectDataError(
      'PROJECT_DATA415',
      `Shot video take rail group references an unknown ${role} production group: ${productionGroupId}.`
    );
  }
  return productionGroup;
}

function addSingleShotProductionGroupsForClearedRailShots(input: {
  oldRailGroups: ShotVideoTakeRailGroup[];
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
  requestedRailShotIds: Set<string>;
  nextProductionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
  allocateProductionGroupId: () => string;
}): void {
  input.oldRailGroups.forEach((oldRailGroup) => {
    const sourceGroup = input.productionGroupsById.get(
      oldRailGroup.productionGroupId
    );
    if (!sourceGroup) {
      throw new ProjectDataError(
        'PROJECT_DATA416',
        `Stored rail group references an unknown production group: ${oldRailGroup.productionGroupId}.`
      );
    }
    oldRailGroup.shotIds.forEach((shotId) => {
      if (input.requestedRailShotIds.has(shotId)) {
        return;
      }
      const existingSingleShotGroup = findSingleShotProductionGroup(
        input.productionGroupsById,
        shotId
      );
      const productionGroupId =
        existingSingleShotGroup?.productionGroupId ??
        (oldRailGroup.shotIds.length === 1
          ? oldRailGroup.productionGroupId
          : input.allocateProductionGroupId());
      input.nextProductionGroupsById.set(productionGroupId, {
        productionGroupId,
        shotIds: [shotId],
        videoTakeProduction: carryProductionPlanForShotMembership({
          plan:
            existingSingleShotGroup?.videoTakeProduction ??
            sourceGroup.videoTakeProduction,
          previousShotIds:
            existingSingleShotGroup?.shotIds ?? sourceGroup.shotIds,
          nextShotIds: [shotId],
        }),
      });
    });
  });
}

function keepUnchangedSingleShotProductionGroups(input: {
  productionGroups: ShotVideoTakeProductionGroup[];
  requestedRailShotIds: Set<string>;
  nextProductionGroupsById: Map<string, ShotVideoTakeProductionGroup>;
}): void {
  input.productionGroups.forEach((productionGroup) => {
    if (productionGroup.shotIds.length !== 1) {
      return;
    }
    const shotId = productionGroup.shotIds[0];
    if (
      !shotId ||
      input.requestedRailShotIds.has(shotId) ||
      input.nextProductionGroupsById.has(productionGroup.productionGroupId)
    ) {
      return;
    }
    input.nextProductionGroupsById.set(
      productionGroup.productionGroupId,
      productionGroup
    );
  });
}

function findSingleShotProductionGroup(
  productionGroupsById: Map<string, ShotVideoTakeProductionGroup>,
  shotId: string
): ShotVideoTakeProductionGroup | undefined {
  return [...productionGroupsById.values()].find((group) =>
    sameShotIds(group.shotIds, [shotId])
  );
}

function carryProductionPlanForShotMembership(input: {
  plan: ShotVideoTakeProductionPlan;
  previousShotIds: string[];
  nextShotIds: string[];
}): ShotVideoTakeProductionPlan {
  const membershipChanged = !sameShotIds(
    input.previousShotIds,
    input.nextShotIds
  );
  const requestedInputs = input.plan.requestedInputs
    ?.filter(
      (requestedInput) =>
        requestedInput.subjectKind !== 'shot' ||
        !requestedInput.subjectId ||
        input.nextShotIds.includes(requestedInput.subjectId)
    )
    .map((requestedInput) => ({ ...requestedInput }));
  const agentProposal = input.plan.agentProposal
    ? {
        ...input.plan.agentProposal,
        ...(membershipChanged
          ? {
              basedOnShotIds:
                input.plan.agentProposal.basedOnShotIds ??
                [...input.previousShotIds],
            }
          : {}),
        dependencyDrafts: input.plan.agentProposal.dependencyDrafts.map(
          (draft) => ({ ...draft })
        ),
        ...(input.plan.agentProposal.finalPromptDraft
          ? {
              finalPromptDraft: {
                ...input.plan.agentProposal.finalPromptDraft,
              },
            }
          : {}),
      }
    : undefined;
  return {
    ...(input.plan.inputModeId ? { inputModeId: input.plan.inputModeId } : {}),
    ...(input.plan.modelChoice ? { modelChoice: input.plan.modelChoice } : {}),
    ...(input.plan.parameterValues
      ? { parameterValues: { ...input.plan.parameterValues } }
      : {}),
    ...(requestedInputs && requestedInputs.length > 0 ? { requestedInputs } : {}),
    ...(!membershipChanged && input.plan.preparedInputs
      ? {
          preparedInputs: input.plan.preparedInputs.map((preparedInput) => ({
            ...preparedInput,
          })),
        }
      : {}),
    ...(agentProposal ? { agentProposal } : {}),
    ...(input.plan.customPromptNote
      ? { customPromptNote: input.plan.customPromptNote }
      : {}),
  };
}

function orderProductionGroupsForShotList(
  shots: SceneShot[],
  groups: ShotVideoTakeProductionGroup[]
): ShotVideoTakeProductionGroup[] {
  const shotOrder = new Map(shots.map((shot, index) => [shot.shotId, index]));
  return [...groups].sort((left, right) => {
    const leftIndex = shotOrder.get(left.shotIds[0] ?? '') ?? Infinity;
    const rightIndex = shotOrder.get(right.shotIds[0] ?? '') ?? Infinity;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.productionGroupId.localeCompare(right.productionGroupId);
  });
}

function prepareShotGroupInSession(input: {
  session: DatabaseSession;
  input: ShotVideoTakeContextInput;
  now: string;
  production?: ShotVideoTakeProductionPlan;
  persist?: boolean;
}): PreparedShotGroup {
  const screenplay = requireScreenplayDocument(input.session);
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.input.sceneId,
    shotListId: input.input.shotListId,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  const orderedShotIds = normalizeShotIds(shotList.shots, input.input.shotIds);
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
  if (input.persist !== false) {
    updateSceneShotListRecordDocument({
      session: input.session,
      id: input.input.shotListId,
      document: updatedShotList,
      screenplay,
      now: input.now,
    });
  }
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
  const narrativeScope = sceneNarrativeReferenceScope({
    session: input.session,
    screenplay,
    sceneId: input.prepared.sceneId,
  });
  const scope = sceneShotReferenceScope({
    screenplay,
    narrativeScope,
    shotList: input.prepared.shotList,
  });
  const selectedLocationIds = selectedLocationIdsForShots(shots);
  const selectedCastMemberIds = selectedNarrativeCastIdsForShots({
    shots,
    narrativeScope,
  });
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
    referencedCast: orderedScreenplayItems(screenplay.cast, selectedCastMemberIds)
      .map((castMember) => ({
        id: castMember.id as string,
        handle: castMember.handle,
        name: castMember.name,
        role: castMember.role,
        description: castMember.description,
      })),
    referencedLocations: scope.locations
      .filter((location) => location.id && selectedLocationIds.has(location.id))
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
    shotGroupMode:
      input.prepared.orderedShotIds.length > 1 ? 'multi-shot' : 'single-shot',
    defaults: {
      inputModeId: 'first-frame',
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
      referenceName: null,
      purpose: null,
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

async function deleteProjectRelativeFile(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<void> {
  const normalizedPath = normalizeProjectRelativePath(projectRelativePath);
  const absolutePath = resolveProjectRelativePath(projectFolder, normalizedPath);
  assertResolvedPathInsideProject(projectFolder, absolutePath);
  await fs.rm(absolutePath, { force: true });
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

function providerModel(
  modelChoice: ShotVideoTakeInputModelChoice | ShotVideoTakeModelChoice
): string {
  if (modelChoice.startsWith('fal-ai/')) {
    return modelChoice.slice('fal-ai/'.length);
  }
  return modelChoice;
}

function requireShotVideoTakeRoute(
  modelChoice: ShotVideoTakeModelChoice,
  inputModeId: ShotVideoTakeInputModeId,
  shotGroupMode: ShotVideoTakeShotGroupMode
): ShotVideoRoute {
  const route = selectShotVideoRoute({ modelChoice, inputMode: inputModeId, shotGroupMode });
  if (!route) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      `Shot video take model does not support the selected input mode and shot group mode: ${modelChoice} / ${inputModeId} / ${shotGroupMode}.`
    );
  }
  return route;
}

function defaultModelChoiceForInputMode(inputModeId: ShotVideoTakeInputModeId): ShotVideoTakeModelChoice {
  if (inputModeId === 'first-last-frame') {
    return 'fal-ai/veo3.1';
  }
  if (inputModeId === 'text-only') {
    return 'fal-ai/bytedance/seedance-2.0';
  }
  return 'fal-ai/bytedance/seedance-2.0';
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
    `Input mode: ${context.productionGroup.videoTakeProduction.inputModeId ?? context.defaults.inputModeId}`,
    `Shot group mode: ${context.shotGroupMode}`,
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
    value === SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE ||
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
