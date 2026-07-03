import type {
  ShotVideoTakeProductionContext,
  ShotVideoTakeOutputGenerationPlan,
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeInputPolicy,
} from '../../../client/index.js';
import {
  requireSceneShotListForScene,
  readSceneShotListDocument,
} from '../../database/access/scene-shot-lists.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  PreviewShotVideoTakeProductionInput,
  PlanShotVideoTakeProductionInput,
} from '../../project-data-service-contracts.js';
import {
  planLinesFromDependencyInventory,
} from '../dependency-inventory-lines.js';
import {
  buildShotVideoTakeReferenceSections,
} from './reference-sections.js';
import {
  createDiagnosticWarning,
} from '@gorenku/studio-diagnostics';
import {
  SHOT_VIDEO_MODEL_FAMILIES,
} from '@gorenku/studio-engines';
import crypto from 'node:crypto';
import {
  buildContextFromPrepared,
} from './context.js';
import {
  buildShotVideoTakeDependencyInventory,
  finalEstimateFromDependencyInventory,
} from './dependency-inventory.js';
import {
  issue,
} from './diagnostics.js';
import {
  validateShotVideoTakeInputPolicy,
} from './input-policy.js';
import {
  defaultModelChoiceForInputMode,
  modelFamilyLabel,
} from './model-list.js';
import {
  preparedInputsForContext,
} from './preflight-inputs.js';
import {
  validatePreflight,
} from './preflight-report.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  sceneNarrativeReferenceScope,
  sceneShotReferenceScope,
} from './reference-scope.js';
import {
  inputRolesForRoute,
  normalizeRouteSettingsForContext,
  parametersForRoute,
  requireShotVideoTakeRoute,
} from './route-settings.js';
import {
  prepareSceneShotVideoTakeInSession,
} from './take-context.js';
import {
  resolveSceneShotVideoTakeEditorDirection,
} from './take-state.js';


export async function shotVideoTakePlanReportContext(
  input: PreviewShotVideoTakeProductionInput
): Promise<Pick<ShotVideoTakeProductionContext, 'target' | 'take'>> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    const context = contextWithProductionOverride({
      context: buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared,
      }),
      production: input.production,
    });
    return { target: context.target, take: context.take };
  });
}



export async function planShotVideoTakeProduction(
  input: PlanShotVideoTakeProductionInput
): Promise<ShotVideoTakeOutputGenerationPlan> {
  const context = await withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return contextWithProductionOverride({
      context: buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared,
      }),
      production: input.production,
    });
  });
  return planShotVideoTakeProductionForContext({
    context,
    inputPolicy: input.inputPolicy,
    projectName: input.projectName,
    homeDir: input.homeDir,
  });
}

export async function planShotVideoTakeProductionForContext(input: {
  context: ShotVideoTakeProductionContext;
  inputPolicy?: ShotVideoTakeInputPolicy;
  projectName?: string;
  homeDir?: string;
}): Promise<ShotVideoTakeOutputGenerationPlan> {
  const context = input.context;
  const diagnostics = validatePreflight(context);
  const inputModeId = context.take.state.production.inputModeId ?? context.defaults.inputModeId;
  const modelChoice =
    context.take.state.production.modelChoice ??
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
        { path: ['take', 'production', 'parameterValues', settingId] },
        'Review Run Setup after switching model or input mode.'
      )
    );
  });
  normalizedSettings.invalidSettingIds.forEach((settingId) => {
    diagnostics.push(
      issue(
        'CORE_SHOT_VIDEO_PLAN_INVALID_SETTING',
        `Shot video take setting is invalid for the selected route: ${settingId}.`,
        ['take', 'production', 'parameterValues', settingId],
        'Choose one of the values supported by the selected route.'
      )
    );
  });
  const inputPolicy = input.inputPolicy === undefined
    ? { defaultMode: 'auto' as const }
    : validateShotVideoTakeInputPolicy(input.inputPolicy);
  const { dependencyInventory } = await withShotProjectSession(
    {
      projectName: input.projectName,
      homeDir: input.homeDir,
    },
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
      takeId: context.take.takeId,
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
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    return buildShotVideoTakeProductionPlanReport({
      session,
      context: contextWithProductionOverride({
        context,
        production: input.production,
      }),
      plan,
      selectedShotId: input.selectedShotId,
    });
  });
}



export function buildShotVideoTakeProductionPlanReport(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  plan: ShotVideoTakeOutputGenerationPlan;
  selectedShotId?: string;
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
  const editorDirection = resolveSceneShotVideoTakeEditorDirection({
    state: input.context.take.state,
    shotIds: input.context.take.shotIds,
    selectedShotId: input.selectedShotId,
  });
  const editorShots =
    input.context.take.state.structure.mode === 'multi-cut'
      ? input.context.shots.filter((shot) => shot.shotId === input.selectedShotId)
      : input.context.shots;
  const referenceSections = buildShotVideoTakeReferenceSections({
    session: input.session,
    context: input.context,
    plan: input.plan,
    narrativeScope,
    scope,
    editorDirection,
    editorShots,
  });
  const diagnostics = [
    ...input.plan.diagnostics,
    ...referenceSections.diagnostics,
  ];
  return {
    target: input.context.target,
    take: input.context.take,
    finalPrompt:
      input.context.take.state.production.agentProposal
        ?.finalPromptDraft ?? null,
    plan: input.plan,
    references: referenceSections.references,
    diagnostics,
  };
}



export function shotVideoTakePlanId(input: {
  targetId: string;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  settings: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>;
  inputPolicy: ShotVideoTakeInputPolicy;
}): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);
  return `shot_video_take_plan_${hash}`;
}

function contextWithProductionOverride(input: {
  context: ShotVideoTakeProductionContext;
  production?: SceneShotVideoTakeProductionState;
}): ShotVideoTakeProductionContext {
  if (!input.production) {
    return input.context;
  }
  return {
    ...input.context,
    take: {
      ...input.context.take,
      state: {
        ...input.context.take.state,
        production: input.production,
      },
    },
  };
}
