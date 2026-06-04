import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  LocationAzimuthViewId,
  MediaGenerationPurpose,
  MediaGenerationDependencyMap,
  MediaGenerationDependencyNode,
  MediaGenerationDependencyPricing,
  MediaGenerationPlanLine,
  MediaGenerationSpec,
  MediaGenerationRunReport,
  MediaGenerationSpecRecord,
  Asset,
  PreparedMediaGeneration,
  ProjectRelativePath,
  SceneShot,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeAvailableInput,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationPlan,
  ShotVideoTakeCastReferenceChoice,
  ShotVideoTakeInputPolicy,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeInputGenerationPurpose,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeInputModelChoiceReport,
  ShotVideoTakeInputModelListReport,
  ShotVideoTakeIntentId,
  ShotVideoTakeImageReferenceChoice,
  ShotVideoTakeLocationReferenceChoice,
  ShotVideoTakeLookbookReferenceChoice,
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
  ShotVideoTakeReferenceCardPlan,
  ShotVideoTakeReferenceChoiceState,
  ShotVideoTakeReferenceImagePreview,
  ShotVideoTakeRequestedInput,
} from '../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../client/index.js';
import { insertAssetFileRecord, readAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import {
  listLocationEnvironmentSheetViews,
  readLocationEnvironmentSheetByAssetId,
} from '../database/access/location-environment-sheets.js';
import { listLookbookImages } from '../database/access/lookbook-images.js';
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
  PlanShotVideoTakeProductionInput,
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
import { draftMediaGenerationSpecRecord } from './draft-generation.js';

type GenerationMode = PreparedMediaGeneration['generation']['policy']['mode'];

interface ShotVideoTakeProviderPlan {
  provider: 'fal-ai';
  model: string;
  mode: GenerationMode;
  outputCount: 1;
  payload: Record<string, unknown>;
  inputFiles: PreparedMediaGeneration['generation']['request']['inputFiles'];
  pricingInputCounts?: PreparedMediaGeneration['generation']['request']['pricingInputCounts'];
}

interface RequiredShotVideoTakeInputSlot {
  outputInputKind: ShotVideoTakeInputKind;
  dependencyId: string;
  dependencyKind: NonNullable<MediaGenerationDependencyNode['dependencyKind']>;
  dependencyTarget?: MediaGenerationDependencyNode['dependencyTarget'];
  purpose?: MediaGenerationPurpose;
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
  const intentId = input.intentId ?? context.defaults.intentId;
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: context.target,
    ...(input.intentId ? { intentId: input.intentId } : {}),
    defaultModelChoice: defaultModelChoiceForIntent(intentId),
    models: modelChoices(context, input.intentId),
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
  const plan = await planShotVideoTakeProduction(input);
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
    intentId,
    modelChoice,
    preparedInputs,
    availableInputs: context.availableInputs,
    inputsToCreate,
    inputPlanItems,
    prompts,
    finalTake: {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      canCreateSpec: plan.dependencyMap.estimate.missingNodeCount === 0 &&
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
    intentId: plan.request.intent,
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
  const intentId = context.productionGroup.videoTakeProduction.intentId ?? context.defaults.intentId;
  const modelChoice =
    context.productionGroup.videoTakeProduction.modelChoice ??
    defaultModelChoiceForIntent(intentId);
  const route = requireShotVideoTakeRoute(modelChoice, intentId);
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
        'Review Run Setup after switching model or intent.'
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
  const preparedInputs = await withShotProjectSession(input, ({ session }) =>
    preparedInputsForContext(context, session, diagnostics)
  );
  const inputPolicy = input.inputPolicy ?? { defaultMode: 'auto' as const };
  const dependencyMap = await buildShotVideoTakeDependencyMap({
    context,
    intentId,
    modelChoice,
    route,
    normalizedSettings: normalizedSettings.values,
    preparedInputs,
    inputPolicy,
    diagnostics,
    projectName: input.projectName,
    homeDir: input.homeDir,
  });
  const lines = planLinesFromDependencyMap(dependencyMap);
  const finalEstimate = finalEstimateFromDependencyMap(dependencyMap);
  return {
    planId: shotVideoTakePlanId({
      targetId: context.target.id,
      intentId,
      modelChoice,
      settings: normalizedSettings.values,
      inputPolicy,
    }),
    request: {
      projectId: context.project.id ?? context.project.name,
      sceneId: context.scene.id,
      shotListId: context.shotList.id,
      productionGroupId: context.productionGroup.productionGroupId,
      intent: intentId,
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
      intent: route.intent,
      providerModel: route.providerModel,
      mode: route.mode,
      inputRoles: inputRolesForRoute(route.inputSlots),
      parameters: parametersForRoute(route),
    },
    dependencyMap,
    lines,
    estimate: {
      state: dependencyMap.estimate.state,
      estimatedTotalUsd: dependencyMap.estimate.estimatedTotalUsd,
      pricedLineCount: dependencyMap.estimate.pricedNodeCount,
      unpricedLineCount: dependencyMap.estimate.unpricedNodeCount,
      missingLineCount: dependencyMap.estimate.missingNodeCount,
      requiresPriceOverride: dependencyMap.estimate.requiresPriceOverride,
    },
    diagnostics: dependencyMap.diagnostics,
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
  return {
    target: input.context.target,
    productionGroup: input.context.productionGroup,
    finalPrompt:
      input.context.productionGroup.videoTakeProduction.agentProposal
        ?.finalPromptDraft ?? null,
    plan: input.plan,
    castReferences: screenplay.cast
      .filter((castMember) => castMember.id)
      .map((castMember) =>
        buildCastReferenceChoice({
          session: input.session,
          context: input.context,
          plan: input.plan,
          castMemberId: castMember.id as string,
          name: castMember.name,
        })
      ),
    locationReferences: screenplay.locations
      .filter((location) => location.id)
      .map((location) =>
        buildLocationReferenceChoice({
          session: input.session,
          context: input.context,
          plan: input.plan,
          locationId: location.id as string,
          name: location.name,
        })
      ),
    lookbookReferences: buildLookbookReferenceChoices({
      session: input.session,
      context: input.context,
      plan: input.plan,
    }),
    imageReferences: buildImageReferenceChoices({
      context: input.context,
      plan: input.plan,
    }),
    diagnostics: input.plan.diagnostics,
  };
}

function buildCastReferenceChoice(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
  castMemberId: string;
  name: string;
}): ShotVideoTakeCastReferenceChoice {
  const dependencyId = dependencyIdForInput(
    'character-sheet',
    'cast-member',
    input.castMemberId
  );
  const node = dependencyNodeById(input.plan, dependencyId);
  const previews = previewImagesForAsset(
    firstAssetForTarget(input.session, {
      target: { kind: 'castMember', castMemberId: input.castMemberId },
      role: 'character_sheet',
    }),
    input.name,
    `${input.name} character sheet`
  );
  const selected = selectedCastIdsForShots(input.context.shots).has(
    input.castMemberId
  );
  return {
    castMemberId: input.castMemberId,
    name: input.name,
    selected,
    defaultSelected: defaultCastIdsForShots(input.context.shots).has(
      input.castMemberId
    ),
    characterSheet: referenceCardPlan({
      selected,
      mediaKind: 'image',
      dependencyId,
      node,
      line: planLineForNode(input.plan, node),
      previews,
    }),
  };
}

function buildLocationReferenceChoice(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
  locationId: string;
  name: string;
}): ShotVideoTakeLocationReferenceChoice {
  const dependencyId = dependencyIdForInput(
    'location-sheet',
    'location',
    input.locationId
  );
  const node = dependencyNodeById(input.plan, dependencyId);
  const environmentSheet = firstAssetForTarget(input.session, {
    target: { kind: 'location', locationId: input.locationId },
    role: 'environment_sheet',
  });
  const previews = previewImagesForAsset(
    environmentSheet,
    input.name,
    `${input.name} environment sheet`
  );
  const selectedLocationIds = selectedLocationIdsForShots(input.context.shots);
  const selected = selectedLocationIds.has(input.locationId);
  return {
    locationId: input.locationId,
    name: input.name,
    selected,
    defaultSelected: defaultLocationIdsForShots(input.context.shots).has(
      input.locationId
    ),
    environmentSheet: referenceCardPlan({
      selected,
      mediaKind: 'image',
      dependencyId,
      node,
      line: planLineForNode(input.plan, node),
      previews,
    }),
    viewChoices: selected
      ? locationViewChoices(input.session, input.context.shots, environmentSheet)
      : [],
  };
}

function buildLookbookReferenceChoices(input: {
  session: DatabaseSession;
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakeLookbookReferenceChoice[] {
  if (!input.context.activeLookbook) {
    return [];
  }
  const lookbookImages = listLookbookImages(
    input.session,
    input.context.activeLookbook.id
  );
  const selectedImageId = selectedLookbookImageIdForShots(input.context.shots);
  const defaultImageId = lookbookImages[0]?.id ?? null;
  const selectedChoiceId = selectedImageId ?? defaultImageId;
  const dependencyId = dependencyIdForInput(
    'reference-image',
    'lookbook',
    input.context.activeLookbook.id
  );
  const node = dependencyNodeById(input.plan, dependencyId);
  const line = planLineForNode(input.plan, node);
  if (lookbookImages.length === 0) {
    return [
      {
        lookbookImageId: null,
        lookbookId: input.context.activeLookbook.id,
        title: input.context.activeLookbook.name,
        selected: true,
        defaultSelected: true,
        image: referenceCardPlan({
          selected: true,
          mediaKind: 'image',
          dependencyId,
          node,
          line,
          previews: [],
        }),
      },
    ];
  }
  return lookbookImages.map((lookbookImage) => ({
    lookbookImageId: lookbookImage.id,
    lookbookId: input.context.activeLookbook!.id,
    title: lookbookImage.asset.title,
    selected: lookbookImage.id === selectedChoiceId,
    defaultSelected: lookbookImage.id === defaultImageId,
    image: referenceCardPlan({
      selected: lookbookImage.id === selectedChoiceId,
      mediaKind: 'image',
      dependencyId,
      node,
      line,
      previews: previewImagesForLookbookImage(
        lookbookImage,
        lookbookImage.asset.title,
        `${lookbookImage.asset.title} lookbook reference`
      ),
    }),
  }));
}

function buildImageReferenceChoices(input: {
  context: ShotVideoTakeGenerationContext;
  plan: ShotVideoTakeGenerationPlan;
}): ShotVideoTakeImageReferenceChoice[] {
  const plannedKinds: Array<{
    referenceKind: Exclude<
      ShotVideoTakeImageReferenceChoice['referenceKind'],
      'custom-reference-image'
    >;
    title: string;
    dependencyId: string;
  }> = [
    {
      referenceKind: 'first-frame',
      title: 'First frame',
      dependencyId: dependencyIdForInput('first-frame'),
    },
    {
      referenceKind: 'last-frame',
      title: 'Last frame',
      dependencyId: dependencyIdForInput('last-frame'),
    },
    {
      referenceKind: 'shot-reference-sheet',
      title: 'Shot reference sheet',
      dependencyId: dependencyIdForInput('shot-reference-sheet'),
    },
  ];
  const plannedChoices = plannedKinds.flatMap((entry) => {
    const node = dependencyNodeById(input.plan, entry.dependencyId);
    if (!node) {
      return [];
    }
    return [
      {
        referenceKind: entry.referenceKind,
        title: entry.title,
        selected: true,
        image: referenceCardPlan({
          selected: true,
          mediaKind: 'image',
          dependencyId: entry.dependencyId,
          node,
          line: planLineForNode(input.plan, node),
          previews: previewImagesForDependencyNode(input.context, node),
        }),
      },
    ];
  });
  const selectedCustomIds = selectedCustomReferenceInputIdsForShots(
    input.context.shots
  );
  const customChoices = input.context.availableInputs
    .filter((availableInput) => selectedCustomIds.has(availableInput.inputId))
    .map((availableInput) => ({
      referenceKind: 'custom-reference-image' as const,
      title: 'Custom reference image',
      selected: true,
      image: referenceCardPlan({
        selected: true,
        mediaKind: availableInput.mediaKind,
        previews: [
          {
            assetId: availableInput.assetId,
            assetFileId: availableInput.assetFileId,
            projectRelativePath: availableInput.projectRelativePath,
            title: 'Custom reference image',
            alt: 'Custom reference image',
          },
        ],
      }),
    }));
  return [...plannedChoices, ...customChoices];
}

function selectedCastIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(
    shots.flatMap(
      (shot) => shot.shotSpecs?.castReferences?.castMemberIds ?? shot.castMemberIds
    )
  );
}

function defaultCastIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(shots.flatMap((shot) => shot.castMemberIds));
}

function selectedLocationIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(
    shots.flatMap((shot) =>
      shot.shotSpecs?.location?.locationId
        ? [shot.shotSpecs.location.locationId]
        : shot.locationIds
    )
  );
}

function defaultLocationIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(shots.flatMap((shot) => shot.locationIds));
}

function selectedLookbookImageIdForShots(shots: SceneShot[]): string | null {
  for (const shot of shots) {
    const lookbookImageId = shot.shotSpecs?.lookbookReference?.lookbookImageId;
    if (lookbookImageId) {
      return lookbookImageId;
    }
  }
  return null;
}

function selectedCustomReferenceInputIdsForShots(shots: SceneShot[]): Set<string> {
  return new Set(
    shots.flatMap(
      (shot) => shot.shotSpecs?.referenceImages?.customReferenceInputIds ?? []
    )
  );
}

function selectedLocationAzimuthViewForShots(
  shots: SceneShot[]
): LocationAzimuthViewId | null {
  for (const shot of shots) {
    if (shot.shotSpecs?.location?.azimuthView) {
      return shot.shotSpecs.location.azimuthView;
    }
  }
  return null;
}

function locationViewChoices(
  session: DatabaseSession,
  shots: SceneShot[],
  environmentSheet: Asset | null
): ShotVideoTakeLocationReferenceChoice['viewChoices'] {
  if (!environmentSheet) {
    return [];
  }
  const sheet = readLocationEnvironmentSheetByAssetId(
    session,
    environmentSheet.assetId
  );
  if (!sheet) {
    return [];
  }
  const selectedView = selectedLocationAzimuthViewForShots(shots);
  return listLocationEnvironmentSheetViews(session, sheet.id).map((view) => {
    const viewId = locationAzimuthViewId(requireLocationAzimuthDegrees(view.azimuthDegrees));
    const assetFile = readAssetFileRecord(session, {
      assetId: sheet.assetId,
      assetFileId: view.assetFileId,
    });
    return {
      viewId,
      label: locationAzimuthViewLabel(viewId),
      selected:
        selectedView === viewId ||
        (!selectedView && view.azimuthDegrees === 0),
      preview: assetFile
        ? {
            assetId: sheet.assetId,
            assetFileId: assetFile.id,
            projectRelativePath:
              assetFile.projectRelativePath as ProjectRelativePath,
            title: locationAzimuthViewLabel(viewId),
            alt: locationAzimuthViewLabel(viewId),
          }
        : null,
    };
  });
}

function requireLocationAzimuthDegrees(value: number): 0 | 90 | 180 | 270 {
  if (value === 0 || value === 90 || value === 180 || value === 270) {
    return value;
  }
  throw new ProjectDataError(
    'PROJECT_DATA403',
    `Unsupported location environment sheet azimuth: ${value}.`,
    { suggestion: 'Regenerate the location environment sheet views.' }
  );
}

function locationAzimuthViewId(
  azimuthDegrees: 0 | 90 | 180 | 270
): LocationAzimuthViewId {
  if (azimuthDegrees === 90) {
    return 'right';
  }
  if (azimuthDegrees === 180) {
    return 'back';
  }
  if (azimuthDegrees === 270) {
    return 'left';
  }
  return 'front';
}

function locationAzimuthViewLabel(viewId: LocationAzimuthViewId): string {
  if (viewId === 'right') {
    return 'Right';
  }
  if (viewId === 'back') {
    return 'Back';
  }
  if (viewId === 'left') {
    return 'Left';
  }
  return 'Front';
}

function firstAssetForTarget(
  session: DatabaseSession,
  input: {
    target: Parameters<typeof listAssetRelationshipPage>[1]['target'];
    role: string;
  }
): Asset | null {
  return (
    listAssetRelationshipPage(session, {
      target: input.target,
      role: input.role,
      mediaKind: 'image',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items[0] ?? null
  );
}

function previewImagesForAsset(
  asset: Asset | null,
  title: string,
  alt: string
): ShotVideoTakeReferenceImagePreview[] {
  if (!asset) {
    return [];
  }
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  return file
    ? [
        {
          assetId: asset.assetId,
          assetFileId: file.id,
          projectRelativePath: file.projectRelativePath,
          title,
          alt,
        },
      ]
    : [];
}

function previewImagesForLookbookImage(
  lookbookImage: ReturnType<typeof listLookbookImages>[number],
  title: string,
  alt: string
): ShotVideoTakeReferenceImagePreview[] {
  const file = lookbookImage.asset.files.find(
    (candidate) => candidate.mediaKind === 'image'
  );
  return file
    ? [
        {
          assetId: lookbookImage.asset.assetId,
          assetFileId: file.id,
          projectRelativePath: file.projectRelativePath,
          title,
          alt,
        },
      ]
    : [];
}

function previewImagesForDependencyNode(
  context: ShotVideoTakeGenerationContext,
  node: MediaGenerationDependencyNode | null
): ShotVideoTakeReferenceImagePreview[] {
  if (!node?.assetId || !node.assetFileId) {
    return [];
  }
  const availableInput = context.availableInputs.find(
    (input) =>
      input.assetId === node.assetId && input.assetFileId === node.assetFileId
  );
  if (!availableInput) {
    return [];
  }
  return [
    {
      assetId: node.assetId,
      assetFileId: node.assetFileId,
      projectRelativePath: availableInput.projectRelativePath,
      title: node.label,
      alt: node.label,
    },
  ];
}

function dependencyNodeById(
  plan: ShotVideoTakeGenerationPlan,
  dependencyId: string
): MediaGenerationDependencyNode | null {
  return (
    plan.dependencyMap.nodes.find(
      (node) => node.dependencyId === dependencyId
    ) ?? null
  );
}

function planLineForNode(
  plan: ShotVideoTakeGenerationPlan,
  node: MediaGenerationDependencyNode | null
): MediaGenerationPlanLine | null {
  if (!node) {
    return null;
  }
  return plan.lines.find((line) => line.nodeId === node.id) ?? null;
}

function referenceCardPlan(input: {
  selected: boolean;
  mediaKind: ShotVideoTakeReferenceCardPlan['mediaKind'];
  dependencyId?: string;
  node?: MediaGenerationDependencyNode | null;
  line?: MediaGenerationPlanLine | null;
  previews?: ShotVideoTakeReferenceImagePreview[];
}): ShotVideoTakeReferenceCardPlan {
  const node = input.node ?? null;
  const line = input.line ?? null;
  const previews = input.previews ?? [];
  return {
    state: referenceChoiceState({
      selected: input.selected,
      node,
      previews,
    }),
    mediaKind: input.mediaKind,
    ...(input.dependencyId ? { dependencyId: input.dependencyId } : {}),
    ...(node ? { dependencyNodeId: node.id } : {}),
    ...(line ? { planLineId: line.id } : {}),
    purpose: line?.purpose ?? node?.purpose ?? null,
    pricing:
      line?.pricing ??
      node?.pricing ?? {
        state: 'not-applicable',
        estimatedUsd: null,
      },
    previews,
    diagnostics: line?.diagnostics ?? node?.diagnostics ?? [],
  };
}

function referenceChoiceState(input: {
  selected: boolean;
  node: MediaGenerationDependencyNode | null;
  previews: ShotVideoTakeReferenceImagePreview[];
}): ShotVideoTakeReferenceChoiceState {
  if (input.selected && input.node?.state === 'ready') {
    return 'selected-ready';
  }
  if (input.selected && input.node?.state === 'planned') {
    return 'selected-planned';
  }
  if (input.selected) {
    return input.previews.length > 0 ? 'selected-ready' : 'unavailable';
  }
  return input.previews.length > 0 ? 'available' : 'not-selected';
}

async function buildShotVideoTakeDependencyMap(input: {
  projectName?: string;
  homeDir?: string;
  context: ShotVideoTakeGenerationContext;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  route: ShotVideoRoute;
  normalizedSettings: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
  preparedInputs: ShotVideoTakePreflightInput[];
  inputPolicy: ShotVideoTakeInputPolicy;
  diagnostics: DiagnosticIssue[];
}): Promise<MediaGenerationDependencyMap> {
  const nodes: MediaGenerationDependencyNode[] = [];
  const edges: MediaGenerationDependencyMap['edges'] = [];
  const requiredSlots = requiredInputSlots(input.context, input.intentId, input.modelChoice, {
    includeReferenceBundleForReferenceRoute: true,
  });
  const finalNodeId = 'final:shot.video-take';
  const finalInputs: ShotVideoTakePreflightInput[] = [...input.preparedInputs];
  const diagnostics = [...input.diagnostics];
  const nodeIds = new Set<string>();

  const addRequiredSlotNode = async (
    slot: RequiredShotVideoTakeInputSlot,
    parentNodeId: string
  ) => {
    const prepared = input.preparedInputs.find((candidate) =>
      preparedInputMatchesSlot(candidate, slot)
    );
    const nodeId = prepared && inputPolicyMode(input.inputPolicy, slot.dependencyId) !== 'regenerate'
      ? `asset:${slot.dependencyId}`
      : slot.purpose
        ? `planned:${slot.dependencyId}`
        : `missing:${slot.dependencyId}`;

    if (nodeIds.has(nodeId)) {
      edges.push({ fromNodeId: nodeId, toNodeId: parentNodeId, dependencyId: slot.dependencyId });
      return nodeId;
    }

    nodeIds.add(nodeId);

    if (prepared && inputPolicyMode(input.inputPolicy, slot.dependencyId) !== 'regenerate') {
      nodes.push({
        id: nodeId,
        kind: 'existing-asset',
        purpose: slot.purpose ?? null,
        mediaKind: slot.mediaKind,
        label: requiredInputLabel(slot),
        state: 'ready',
        pricing: { state: 'priced', estimatedUsd: 0 },
        dependencyId: slot.dependencyId,
        dependencyKind: slot.dependencyKind,
        dependencyTarget: slot.dependencyTarget,
        assetId: prepared.assetId,
        assetFileId: prepared.assetFileId,
        diagnostics: [],
      });
      edges.push({ fromNodeId: nodeId, toNodeId: parentNodeId, dependencyId: slot.dependencyId });
      return nodeId;
    }

    if (slot.purpose) {
      const draftGenerationSpec = draftSpecForDependency({
        context: input.context,
        slot,
      });
      const pricing = await estimateDraftDependency(
        {
          projectName: input.projectName,
          homeDir: input.homeDir,
          draftGenerationSpec,
        },
        diagnostics
      );
      nodes.push({
        id: nodeId,
        kind: 'planned-generation',
        purpose: slot.purpose,
        mediaKind: slot.mediaKind,
        label: requiredInputLabel(slot),
        state: 'planned',
        pricing,
        dependencyId: slot.dependencyId,
        dependencyKind: slot.dependencyKind,
        dependencyTarget: slot.dependencyTarget,
        draftGenerationSpec,
        diagnostics: pricing.state === 'unpriced'
          ? [
              issue(
                'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
                `Dependency generation is not priced: ${requiredInputLabel(slot)}.`,
                ['dependencyMap', 'nodes', nodeId],
                pricing.reason
              ),
            ]
          : [],
      });
      edges.push({ fromNodeId: nodeId, toNodeId: parentNodeId, dependencyId: slot.dependencyId });
      if (isShotInputPurpose(slot.purpose)) {
        for (const referenceSlot of referenceBundleSlots(input.context)) {
          await addRequiredSlotNode(referenceSlot, nodeId);
        }
      }
      return nodeId;
    }

    const missingIssue = issue(
      'CORE_SHOT_VIDEO_PLAN_REQUIRED_ATTACHMENT_MISSING',
      `Required shot video take input must be attached before final generation: ${requiredInputLabel(slot)}.`,
      ['dependencyMap', 'nodes', nodeId],
      'Attach or select a concrete project asset for this input.'
    );
    diagnostics.push(missingIssue);
    nodes.push({
      id: nodeId,
      kind: 'external-input-required',
      purpose: null,
      mediaKind: slot.mediaKind,
      label: requiredInputLabel(slot),
      state: 'missing',
      pricing: { state: 'not-applicable', estimatedUsd: null },
      dependencyId: slot.dependencyId,
      dependencyKind: slot.dependencyKind,
      dependencyTarget: slot.dependencyTarget,
      diagnostics: [missingIssue],
    });
    edges.push({ fromNodeId: nodeId, toNodeId: parentNodeId, dependencyId: slot.dependencyId });
    return nodeId;
  };

  for (const slot of requiredSlots) {
    await addRequiredSlotNode(slot, finalNodeId);
  }

  const finalPricing = await estimateFinalPlanLine({
    context: input.context,
    intentId: input.intentId,
    modelChoice: input.modelChoice,
    normalizedSettings: input.normalizedSettings,
    preparedInputs: finalInputs,
    diagnostics,
  });
  nodes.push({
    id: finalNodeId,
    kind: 'final-generation',
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    mediaKind: 'video',
    label: 'Final video take',
    state: nodes.some((node) => node.kind === 'external-input-required') ? 'missing' : 'planned',
    pricing: finalPricing.pricing,
    dependencyTarget: input.context.target,
    diagnostics: finalPricing.diagnostics,
  });

  const estimate = aggregateDependencyEstimate(nodes);
  const dependencyLevels = plannedGenerationLevels(nodes, edges);
  const levels = [
    ...dependencyLevels,
    ...(nodes.some((node) => node.kind === 'external-input-required') ? [] : [[finalNodeId]]),
  ];
  const dependencyMap: MediaGenerationDependencyMap & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  } = {
    rootPurpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    nodes,
    edges,
    estimate,
    execution: {
      topologicalNodeIds: levels.flat(),
      levels,
      diagnostics: [],
    },
    diagnostics,
  };
  dependencyMap.finalEstimate = finalPricing.estimate;
  return dependencyMap;
}

function aggregateDependencyEstimate(
  nodes: MediaGenerationDependencyNode[]
): MediaGenerationDependencyMap['estimate'] {
  const priced = nodes.filter(
    (node): node is MediaGenerationDependencyNode & {
      pricing: { state: 'priced'; estimatedUsd: number };
    } => node.pricing.state === 'priced'
  );
  const unpriced = nodes.filter((node) => node.pricing.state === 'unpriced');
  const missing = nodes.filter((node) => node.state === 'missing');
  const total = priced.reduce((sum, node) => sum + node.pricing.estimatedUsd, 0);
  return {
    state: missing.length > 0 ? 'unavailable' : unpriced.length > 0 ? 'partial' : 'complete',
    estimatedTotalUsd: total,
    pricedNodeCount: priced.length,
    unpricedNodeCount: unpriced.length,
    missingNodeCount: missing.length,
    requiresPriceOverride: unpriced.length > 0,
  };
}

function plannedGenerationLevels(
  nodes: MediaGenerationDependencyNode[],
  edges: MediaGenerationDependencyMap['edges']
): string[][] {
  const plannedNodeIds = new Set(
    nodes.filter((node) => node.kind === 'planned-generation').map((node) => node.id)
  );
  const unresolved = new Set(plannedNodeIds);
  const levels: string[][] = [];

  while (unresolved.size > 0) {
    const level = [...unresolved].filter((nodeId) =>
      edges
        .filter((edge) => edge.toNodeId === nodeId)
        .every((edge) => !plannedNodeIds.has(edge.fromNodeId) || !unresolved.has(edge.fromNodeId))
    );
    if (level.length === 0) {
      throw new ProjectDataError(
        'PROJECT_DATA389',
        'Shot video take dependency graph contains a cycle.'
      );
    }
    levels.push(level);
    level.forEach((nodeId) => unresolved.delete(nodeId));
  }

  return levels;
}

function dependencyDepths(
  dependencyMap: MediaGenerationDependencyMap
): Map<string, number> {
  const depths = new Map<string, number>();
  const nodeIds = new Set(dependencyMap.nodes.map((node) => node.id));

  const depthFor = (nodeId: string, visiting: Set<string>): number => {
    const existing = depths.get(nodeId);
    if (existing !== undefined) {
      return existing;
    }
    if (visiting.has(nodeId)) {
      throw new ProjectDataError(
        'PROJECT_DATA389',
        'Shot video take dependency graph contains a cycle.'
      );
    }
    visiting.add(nodeId);
    const childDepths = dependencyMap.edges
      .filter((edge) => edge.toNodeId === nodeId && nodeIds.has(edge.fromNodeId))
      .map((edge) => depthFor(edge.fromNodeId, visiting));
    visiting.delete(nodeId);
    const depth = childDepths.length > 0 ? Math.max(...childDepths) + 1 : 0;
    depths.set(nodeId, depth);
    return depth;
  };

  dependencyMap.nodes.forEach((node) => depthFor(node.id, new Set()));
  return depths;
}

function planLinesFromDependencyMap(
  dependencyMap: MediaGenerationDependencyMap
): MediaGenerationPlanLine[] {
  const orderedNodeIds = [
    ...dependencyMap.execution.topologicalNodeIds,
    ...dependencyMap.nodes
      .map((node) => node.id)
      .filter((nodeId) => !dependencyMap.execution.topologicalNodeIds.includes(nodeId)),
  ];
  const nodesById = new Map(dependencyMap.nodes.map((node) => [node.id, node]));
  const depths = dependencyDepths(dependencyMap);
  return orderedNodeIds.flatMap((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return [];
    }
    return [
      {
        id: `line:${node.id}`,
        nodeId: node.id,
        kind: planLineKind(node),
        label: node.label,
        purpose: node.purpose,
        mediaKind: node.mediaKind,
        ...(node.dependencyId ? { dependencyId: node.dependencyId } : {}),
        ...(node.dependencyKind ? { dependencyKind: node.dependencyKind } : {}),
        depth: depths.get(node.id) ?? 0,
        state: node.state,
        pricing: node.pricing,
        ...(node.assetId ? { sourceAssetId: node.assetId } : {}),
        ...(node.draftGenerationSpec ? { draftGenerationSpec: node.draftGenerationSpec } : {}),
        diagnostics: node.diagnostics,
      },
    ];
  });
}

function planLineKind(node: MediaGenerationDependencyNode): MediaGenerationPlanLine['kind'] {
  if (node.kind === 'existing-asset') {
    return 'reused-asset';
  }
  if (node.kind === 'planned-generation') {
    return 'dependency-generation';
  }
  if (node.kind === 'external-input-required') {
    return 'required-attachment';
  }
  return 'final-video-generation';
}

function finalEstimateFromDependencyMap(
  dependencyMap: MediaGenerationDependencyMap
): ShotVideoTakePreflightReport['estimate'] {
  return (dependencyMap as MediaGenerationDependencyMap & {
    finalEstimate?: ShotVideoTakePreflightReport['estimate'];
  }).finalEstimate ?? null;
}

async function estimateDraftDependency(
  input: {
    projectName?: string;
    homeDir?: string;
    draftGenerationSpec: NonNullable<MediaGenerationDependencyNode['draftGenerationSpec']>;
  },
  diagnostics: DiagnosticIssue[]
): Promise<MediaGenerationDependencyPricing> {
  try {
    const { estimateDraftMediaGenerationSpec } = await import('./shared-generation-service.js');
    const estimateReport = await estimateDraftMediaGenerationSpec({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: input.draftGenerationSpec.spec,
    });
    const estimate = estimateReport.estimate;
    if (estimate.estimatedCostUsd === null) {
      return {
        state: 'unpriced',
        estimatedUsd: null,
        reason: estimate.warnings.join(' ') || 'No pricing is configured for this dependency route.',
        overrideRequired: true,
      };
    }
    return { state: 'priced', estimatedUsd: estimate.estimatedCostUsd };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dependency estimate failed.';
    diagnostics.push(
      issue(
        'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
        message,
        ['dependencyMap', 'nodes'],
        'Review the dependency draft spec and provider pricing support.'
      )
    );
    return {
      state: 'unpriced',
      estimatedUsd: null,
      reason: message,
      overrideRequired: true,
    };
  }
}

async function estimateFinalPlanLine(input: {
  context: ShotVideoTakeGenerationContext;
  intentId: ShotVideoTakeIntentId;
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
      intentId: input.intentId,
      modelChoice: input.modelChoice,
      preparedInputs: input.preparedInputs,
      parameterValues: input.normalizedSettings,
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
            ['dependencyMap', 'nodes', 'final:shot.video-take'],
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
      ['dependencyMap', 'nodes', 'final:shot.video-take'],
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

function draftSpecForDependency(input: {
  context: ShotVideoTakeGenerationContext;
  slot: RequiredShotVideoTakeInputSlot;
}): NonNullable<MediaGenerationDependencyNode['draftGenerationSpec']> {
  if (!input.slot.purpose) {
    throw new ProjectDataError(
      'PROJECT_DATA387',
      `Shot video dependency has no generation purpose: ${input.slot.outputInputKind}.`
    );
  }
  if (input.slot.purpose === CAST_CHARACTER_SHEET_GENERATION_PURPOSE) {
    const spec: MediaGenerationSpec = {
      purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
      target: requireDependencyTarget(input.slot, 'castMember'),
      modelChoice: 'fal-ai/openai/gpt-image-2',
      prompt: dependencyPrompt(input.context, input.slot),
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      detail: 'standard',
      outputFormat: 'png',
      title: requiredInputLabel(input.slot),
    };
    return { purpose: input.slot.purpose, spec };
  }
  if (input.slot.purpose === LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE) {
    const spec: MediaGenerationSpec = {
      purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
      target: requireDependencyTarget(input.slot, 'location'),
      modelChoice: 'fal-ai/openai/gpt-image-2',
      prompt: dependencyPrompt(input.context, input.slot),
      takeCount: 1,
      seed: null,
      sheetFrame: '4:3',
      viewFrame: '16:9',
      detail: 'standard',
      outputFormat: 'png',
      title: requiredInputLabel(input.slot),
    };
    return { purpose: input.slot.purpose, spec };
  }
  if (input.slot.purpose === LOOKBOOK_IMAGE_GENERATION_PURPOSE) {
    const spec: MediaGenerationSpec = {
      purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
      target: requireDependencyTarget(input.slot, 'lookbook'),
      modelChoice: 'fal-ai/openai/gpt-image-2',
      prompt: dependencyPrompt(input.context, input.slot),
      focusSections: ['thesis', 'palette', 'composition'],
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      detail: 'standard',
      outputFormat: 'png',
      title: requiredInputLabel(input.slot),
    };
    return { purpose: input.slot.purpose, spec };
  }
  if (!isShotInputPurpose(input.slot.purpose)) {
    throw new ProjectDataError(
      'PROJECT_DATA387',
      `Unsupported generated shot video dependency purpose: ${input.slot.purpose}.`
    );
  }
  const draft = input.context.productionGroup.videoTakeProduction.agentProposal?.dependencyDrafts.find(
    (candidate) =>
      candidate.purpose === input.slot.purpose &&
      candidate.outputInputKind === input.slot.outputInputKind
  );
  const spec: ShotVideoTakeInputGenerationSpec = {
    purpose: input.slot.purpose,
    target: input.context.target,
    dependencyKind: dependencyKindForPurpose(input.slot.purpose),
    outputInputKind: input.slot.outputInputKind,
    modelChoice: draft?.modelChoice ?? input.context.defaults.imageDependencyModelChoice,
    prompt: draft?.prompt ?? dependencyPrompt(input.context, input.slot),
    parameterValues: draft?.parameterValues ?? defaultShotInputParameterValues(),
    title: draft?.title ?? requiredInputLabel(input.slot),
  };
  return { purpose: input.slot.purpose, spec };
}

type DependencyTarget = NonNullable<MediaGenerationDependencyNode['dependencyTarget']>;

function requireDependencyTarget<T extends DependencyTarget['kind']>(
  slot: RequiredShotVideoTakeInputSlot,
  kind: T
): Extract<DependencyTarget, { kind: T }> {
  if (!slot.dependencyTarget || slot.dependencyTarget.kind !== kind) {
    throw new ProjectDataError(
      'PROJECT_DATA387',
      `Dependency ${slot.dependencyId} requires target.kind "${kind}".`
    );
  }
  return slot.dependencyTarget as Extract<DependencyTarget, { kind: T }>;
}

function defaultShotInputParameterValues(): NonNullable<ShotVideoTakeProductionPlan['parameterValues']> {
  return {
    image_size: { width: 1024, height: 768 },
    quality: 'low',
  };
}

function dependencyPrompt(
  context: ShotVideoTakeGenerationContext,
  slot: RequiredShotVideoTakeInputSlot
): string {
  return [
    agentBrief(context),
    `Create the ${requiredInputLabel(slot)} image needed before the final shot video take.`,
  ].join('\n');
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
  intentId: ShotVideoTakeIntentId;
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
  'shot-reference-sheet': 'Reference sheet',
  'character-sheet': 'Character sheet',
  'location-sheet': 'Location sheet',
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
    const key = dependencyIdForInput(
      availableInput.kind,
      availableInput.subjectKind,
      availableInput.subjectId
    );
    candidatesByDependencyId.set(key, [
      ...(candidatesByDependencyId.get(key) ?? []),
      availableInput,
    ]);
  });

  input.plan.lines.forEach((line) => {
    if (line.kind === 'final-video-generation') {
      return;
    }
    const node = input.plan.dependencyMap.nodes.find((candidate) => candidate.id === line.nodeId);
    const dependencyId = line.dependencyId;
    const candidates = dependencyId ? (candidatesByDependencyId.get(dependencyId) ?? []) : [];
    const selected = candidates.find((candidate) => candidate.selected);
    const prepared = dependencyId
      ? input.preparedInputs.find(
          (candidate) =>
            dependencyIdForInput(candidate.kind, candidate.subjectKind, candidate.subjectId) === dependencyId
        )
      : undefined;
    const source = prepared ?? selected;
    items.push({
      key: line.id,
      title: inputItemTitle(input.context, node, line),
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
      dependencyNodeId: line.nodeId,
      purpose: line.purpose,
      pricing: line.pricing,
      ...(node ? slotForNode(node) : {}),
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
  node: MediaGenerationDependencyNode | undefined,
  line: MediaGenerationPlanLine
): string {
  const target = node?.dependencyTarget;
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
  return inputKindLabel(parseDependencyId(line.dependencyId)?.kind ?? 'reference-image');
}

function inputItemCaption(line: MediaGenerationPlanLine): string {
  if (line.dependencyKind === 'cast-character-sheet') {
    return 'Character sheet';
  }
  if (line.dependencyKind === 'location-environment-sheet') {
    return 'Location sheet';
  }
  if (line.dependencyKind === 'lookbook-reference-image') {
    return 'Lookbook reference';
  }
  const parsed = parseDependencyId(line.dependencyId);
  if (parsed) {
    return inputKindLabel(parsed.kind);
  }
  return line.label;
}

function slotForNode(
  node: MediaGenerationDependencyNode
): Pick<ShotVideoTakePreflightInputItem, 'slot'> {
  const parsed = parseDependencyId(node.dependencyId);
  if (!parsed) {
    return {};
  }
  return {
    slot: {
      kind: parsed.kind,
      ...(parsed.subjectKind ? { subjectKind: parsed.subjectKind } : {}),
      ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}),
    },
  };
}

function parseDependencyId(
  dependencyId?: string
): {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
} | null {
  if (!dependencyId) {
    return null;
  }
  const [kind, subjectKind, subjectId] = dependencyId.split(':');
  if (!isShotVideoTakeInputKind(kind)) {
    return null;
  }
  return {
    kind,
    ...(isShotVideoTakeInputSubjectKind(subjectKind) ? { subjectKind } : {}),
    ...(subjectId ? { subjectId } : {}),
  };
}

function isShotVideoTakeInputKind(value: string | undefined): value is ShotVideoTakeInputKind {
  return Boolean(value && value in SHOT_VIDEO_TAKE_INPUT_KIND_LABELS);
}

function isShotVideoTakeInputSubjectKind(
  value: string | undefined
): value is ShotVideoTakeInputSubjectKind {
  return value === 'cast-member' || value === 'location' || value === 'lookbook' ||
    value === 'shot' || value === 'production-group';
}

function inputKindLabel(kind: ShotVideoTakeInputKind): string {
  return SHOT_VIDEO_TAKE_INPUT_KIND_LABELS[kind] ?? kind;
}

function finalTakeSpecForPreflight(input: {
  context: ShotVideoTakeGenerationContext;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  parameterValues?: NonNullable<ShotVideoTakeProductionPlan['parameterValues']>;
}): ShotVideoTakeGenerationSpec {
  const plan = input.context.productionGroup.videoTakeProduction;
  const finalDraft = plan.agentProposal?.finalPromptDraft;
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target: input.context.target,
    intentId: input.intentId,
    modelChoice: input.modelChoice,
    prompt: finalDraft?.prompt ?? agentBrief(input.context),
    ...(finalDraft?.negativePrompt ? { negativePrompt: finalDraft.negativePrompt } : {}),
    parameterValues:
      input.parameterValues ??
      parameterValuesForFinalTake(input.context, input.intentId, input.modelChoice),
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
  intentId: ShotVideoTakeIntentId,
  modelChoice: ShotVideoTakeModelChoice
): NonNullable<ShotVideoTakeProductionPlan['parameterValues']> {
  const report = modelChoices(context, intentId).find((model) => model.modelChoice === modelChoice);
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
  const route = requireShotVideoTakeRoute(spec.modelChoice, spec.intentId);
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
  const route = requireShotVideoTakeRoute(spec.modelChoice, spec.intentId);
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
  const route = requireShotVideoTakeRoute(input.spec.modelChoice, input.spec.intentId);
  const requiredImageInputCount = requiredInputSlots(
    input.context,
    input.spec.intentId,
    input.spec.modelChoice,
    { includeReferenceBundleForReferenceRoute: true }
  ).filter((slot) => slot.mediaKind === 'image').length;
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
      'shot-reference-sheet',
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
  validateIntentForShotCount(spec.intentId, spec.target.shotIds);
  const report = modelChoices(context, spec.intentId).find((model) => model.modelChoice === spec.modelChoice);
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
  const selectedIntent = intentId ?? context.defaults.intentId;
  const models = SHOT_VIDEO_MODEL_FAMILIES.map((family) =>
    modelReport(family, selectedIntent)
  );
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
  intentId: ShotVideoTakeIntentId
): ShotVideoTakeModelChoiceReport {
  const route = family.routes.find((candidate) => candidate.intent === intentId);
  return {
    modelChoice: family.choice,
    label: modelFamilyLabel(family),
    available: Boolean(route),
    ...(!route ? { unavailableReason: `This model does not support ${intentId}.` } : {}),
    supportedIntents: family.routes.map((candidate) => candidate.intent),
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
      dependencyId: slot.dependencyId,
      dependencyKind: slot.dependencyKind,
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
  modelChoice: ShotVideoTakeModelChoice,
  options: { includeReferenceBundleForReferenceRoute?: boolean } = {}
): RequiredShotVideoTakeInputSlot[] {
  const report = modelChoices(context, intentId).find((model) => model.modelChoice === modelChoice);
  const route = requireShotVideoTakeRoute(modelChoice, intentId);
  const referenceSlots =
    options.includeReferenceBundleForReferenceRoute &&
    route.inputSlots.some((slot) => slot.kind === 'reference-image')
      ? referenceBundleSlots(context)
      : [];
  const modelSlots =
    report?.inputRoles
      .filter((role) => role.required)
      .flatMap((role) =>
        role.kind === 'reference-image'
          ? referenceBundleSlots(context)
          : [
              requiredSlotForInputKind(
                role.kind,
                role.mediaKind,
                `The selected ${report.label} model requires a ${role.kind} input.`
              ),
            ]
      ) ?? [];
  const planSlots = (context.productionGroup.videoTakeProduction.requestedInputs ?? []).map(
    requiredSlotForRequestedInput
  );
  return uniqueRequiredInputSlots([...referenceSlots, ...modelSlots, ...planSlots]);
}

function referenceBundleSlots(
  context: ShotVideoTakeGenerationContext
): RequiredShotVideoTakeInputSlot[] {
  const castSlots = context.referencedCast.map((castMember) =>
    requiredSlotForInputKind(
      'character-sheet',
      'image',
      `Character sheet reference is required for ${castMember.name}.`,
      'cast-member',
      castMember.id
    )
  );
  const locationSlots = context.referencedLocations.map((location) =>
    requiredSlotForInputKind(
      'location-sheet',
      'image',
      `Location sheet reference is required for ${location.name}.`,
      'location',
      location.id
    )
  );
  const lookbookSlots = context.activeLookbook
    ? [
        requiredSlotForInputKind(
          'reference-image',
          'image',
          `Lookbook reference is required for ${context.activeLookbook.name}.`,
          'lookbook',
          context.activeLookbook.id
        ),
      ]
    : [];
  return [...castSlots, ...locationSlots, ...lookbookSlots];
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
  const dependency = dependencyForInputKind(kind, subjectKind, subjectId);
  return {
    outputInputKind: kind,
    ...dependency,
    ...(subjectKind ? { subjectKind } : {}),
    ...(subjectId ? { subjectId } : {}),
    mediaKind,
    reason,
  };
}

function dependencyForInputKind(
  kind: ShotVideoTakeInputKind,
  subjectKind?: ShotVideoTakeInputSubjectKind,
  subjectId?: string
): Pick<
  RequiredShotVideoTakeInputSlot,
  'dependencyId' | 'dependencyKind' | 'dependencyTarget' | 'purpose'
> {
  if (kind === 'first-frame') {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'first-frame',
      purpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE,
    };
  }
  if (kind === 'last-frame') {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'last-frame',
      purpose: SHOT_LAST_FRAME_GENERATION_PURPOSE,
    };
  }
  if (kind === 'shot-reference-sheet') {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'shot-reference-sheet',
      purpose: SHOT_REFERENCE_SHEET_GENERATION_PURPOSE,
    };
  }
  if (kind === 'multi-shot-storyboard-sheet') {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'multi-shot-storyboard-sheet',
      purpose: SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
    };
  }
  if (kind === 'character-sheet' && subjectKind === 'cast-member' && subjectId) {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'cast-character-sheet',
      dependencyTarget: { kind: 'castMember', id: subjectId },
      purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
    };
  }
  if (kind === 'location-sheet' && subjectKind === 'location' && subjectId) {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'location-environment-sheet',
      dependencyTarget: { kind: 'location', id: subjectId },
      purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
    };
  }
  if (kind === 'reference-image' && subjectKind === 'lookbook' && subjectId) {
    return {
      dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
      dependencyKind: 'lookbook-reference-image',
      dependencyTarget: { kind: 'lookbook', id: subjectId },
      purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
    };
  }
  return {
    dependencyId: dependencyIdForInput(kind, subjectKind, subjectId),
    dependencyKind: 'manual-attachment',
  };
}

function dependencyIdForInput(
  kind: ShotVideoTakeInputKind,
  subjectKind?: ShotVideoTakeInputSubjectKind,
  subjectId?: string
): string {
  return [kind, subjectKind ?? 'production-group', subjectId ?? ''].join(':');
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
  const castIds = selectedCastIdsForShots(shots);
  const locationIds = selectedLocationIdsForShots(shots);
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

function requireShotVideoTakeRoute(
  modelChoice: ShotVideoTakeModelChoice,
  intentId: ShotVideoTakeIntentId
): ShotVideoRoute {
  const route = selectShotVideoRoute({ modelChoice, intent: intentId });
  if (!route) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      `Shot video take model does not support the selected intent: ${modelChoice} / ${intentId}.`
    );
  }
  return route;
}

function defaultModelChoiceForIntent(intentId: ShotVideoTakeIntentId): ShotVideoTakeModelChoice {
  if (intentId === 'first-last-frame') {
    return 'fal-ai/veo3.1';
  }
  if (intentId === 'text-only') {
    return 'fal-ai/bytedance/seedance-2.0';
  }
  if (intentId === 'multi-shot') {
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
