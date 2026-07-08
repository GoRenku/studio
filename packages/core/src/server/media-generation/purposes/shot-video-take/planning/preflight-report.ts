import {
  IMAGE_CREATE_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionContext,
  SceneShotVideoTakeProductionState,
} from '../../../../../client/index.js';
import type {
  PreviewShotVideoTakeProductionInput,
} from '../../../../project-data-service-contracts.js';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  selectShotVideoRoute,
} from '@gorenku/studio-engines';
import {
  buildShotVideoTakeContext,
} from '../authoring/context.js';
import {
  issue,
} from '../shared/diagnostics.js';
import {
  defaultModelChoiceForInputMode,
} from '../specs/model-list.js';
import {
  buildShotVideoTakePreflightInputItems,
  inputsToCreateFromDependencyInventory,
  preparedInputsForContext,
} from './preflight-inputs.js';
import {
  planShotVideoTakeProduction,
  planShotVideoTakeProductionForContext,
} from './production-plan.js';
import {
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  missingRequiredRouteInputLabelsForPreparedInputs,
} from '../shared/route-settings.js';
import {
  sameShotIds,
} from '../authoring/take-context.js';



export async function previewShotVideoTakeProduction(
  input: PreviewShotVideoTakeProductionInput
): Promise<ShotVideoTakePreflightReport> {
  const context = contextWithProductionOverride({
    context: await buildShotVideoTakeContext(input),
    production: input.production,
  });
  return previewShotVideoTakeProductionForContext({
    context,
    projectName: input.projectName,
    homeDir: input.homeDir,
    input,
  });
}

export async function previewShotVideoTakeProductionForContext(input: {
  context: ShotVideoTakeProductionContext;
  projectName?: string;
  homeDir?: string;
  input?: PreviewShotVideoTakeProductionInput;
}): Promise<ShotVideoTakePreflightReport> {
  const context = input.context;
  const issues = validatePreflight(context);
  const inputModeId = context.take.state.production.inputModeId ?? context.defaults.inputModeId;
  const modelChoice =
    context.take.state.production.modelChoice ??
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
  const finalDraft = context.take.state.production.agentProposal?.finalPromptDraft;
  const prompts = [
    ...context.take.state.production.agentProposal?.dependencyDrafts.map((draft) => ({
      purpose: IMAGE_CREATE_GENERATION_PURPOSE,
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
  const plan = input.input
    ? await planShotVideoTakeProduction(input.input)
    : await planShotVideoTakeProductionForContext({
        context,
        projectName: input.projectName,
        homeDir: input.homeDir,
      });
  const inputsToCreate = inputsToCreateFromDependencyInventory(plan.dependencyInventory);
  const inputPlanItems = buildShotVideoTakePreflightInputItems({
    context,
    preparedInputs,
    mediaInputs: context.mediaInputs,
    inputsToCreate,
    plan,
  });
  return {
    valid: plan.diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    issues: plan.diagnostics,
    plan,
    target: context.target,
    take: context.take,
    inputModeId,
    shotGroupMode: context.shotGroupMode,
    modelChoice,
    preparedInputs,
    mediaInputs: context.mediaInputs,
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



export function contextWithProductionOverride(input: {
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



export function validatePreflight(context: ShotVideoTakeProductionContext): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const plan = context.take.state.production;
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
        ['take', 'production', 'inputModeId'],
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
          ['take', 'production', 'agentProposal', 'basedOnInputModeId'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
    if (plan.agentProposal.basedOnModelChoice !== modelChoice) {
      issues.push(
        issue(
          'PROJECT_DATA377',
          'Shot video take agent proposal is stale for the current model.',
          ['take', 'production', 'agentProposal', 'basedOnModelChoice'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
    if (
      plan.agentProposal.basedOnShotIds &&
      !sameShotIds(plan.agentProposal.basedOnShotIds, context.take.shotIds)
    ) {
      issues.push(
        issue(
          'PROJECT_DATA378',
          'Shot video take agent proposal is stale for the current shot group.',
          ['take', 'production', 'agentProposal', 'basedOnShotIds'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
  }
  return issues;
}



export function agentBrief(context: ShotVideoTakeProductionContext): string {
  const inputModeId = context.take.state.production.inputModeId ?? context.defaults.inputModeId;
  const modelChoice =
    context.take.state.production.modelChoice ??
    defaultModelChoiceForInputMode(inputModeId);
  return [
    `Scene: ${context.scene.title}`,
    `Shots: ${context.shots.map((shot) => `${shot.shotId}: ${shot.action}`).join(' | ')}`,
    `Input mode: ${inputModeId}`,
    `Shot group mode: ${context.shotGroupMode}`,
    `Model: ${modelChoice}`,
  ].join('\n');
}
