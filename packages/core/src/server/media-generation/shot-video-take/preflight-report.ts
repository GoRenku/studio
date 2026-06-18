import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ShotVideoTakePreflightReport,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakePreflightInput,
  ShotVideoTakeGenerationProduction,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeModelChoiceReport,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  PreviewShotVideoTakeProductionInput,
} from '../../project-data-service-contracts.js';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  selectShotVideoRoute,
} from '@gorenku/studio-engines';
import {
  buildShotVideoTakeContext,
} from './context.js';
import {
  issue,
} from './diagnostics.js';
import {
  defaultModelChoiceForInputMode,
  modelChoices,
} from './model-list.js';
import {
  buildShotVideoTakePreflightInputItems,
  inputsToCreateFromDependencyInventory,
  preparedInputsForContext,
} from './preflight-inputs.js';
import {
  planShotVideoTakeProduction,
} from './production-plan.js';
import {
  withShotProjectSession,
} from './project-session.js';
import {
  filterPreparedInputsByReferenceInclusions,
} from './reference-inclusions.js';
import {
  durationSeconds,
  missingRequiredRouteInputLabelsForPreparedInputs,
} from './route-settings.js';
import {
  sameShotIds,
} from './take-generation-context.js';



export async function previewShotVideoTakeProduction(
  input: PreviewShotVideoTakeProductionInput
): Promise<ShotVideoTakePreflightReport> {
  const context = contextWithProductionOverride({
    context: await buildShotVideoTakeContext(input),
    production: input.production,
  });
  const issues = validatePreflight(context);
  const inputModeId = context.takeGeneration.production.inputModeId ?? context.defaults.inputModeId;
  const modelChoice =
    context.takeGeneration.production.modelChoice ??
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
  const finalDraft = context.takeGeneration.production.agentProposal?.finalPromptDraft;
  const prompts = [
    ...context.takeGeneration.production.agentProposal?.dependencyDrafts.map((draft) => ({
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
    takeGeneration: context.takeGeneration,
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



export function finalTakeSpecForPreflight(input: {
  context: ShotVideoTakeGenerationContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  parameterValues?: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>;
  promptMode?: 'require-authored' | 'estimate-placeholder';
}): ShotVideoTakeGenerationSpec {
  const plan = input.context.takeGeneration.production;
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
  const includedPreparedInputs = filterPreparedInputsByReferenceInclusions(
    input.context,
    input.preparedInputs
  );
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
    inputs: includedPreparedInputs.map((preparedInput) => ({
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



export function parameterValuesForFinalTake(
  context: ShotVideoTakeGenerationContext,
  inputModeId: ShotVideoTakeInputModeId,
  modelChoice: ShotVideoTakeModelChoice
): NonNullable<ShotVideoTakeGenerationProduction['parameterValues']> {
  const report = modelChoices(context, inputModeId).find((model) => model.modelChoice === modelChoice);
  if (!report) {
    return {};
  }
  const values: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']> = {};
  const planValues = context.takeGeneration.production.parameterValues ?? {};
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



export function canonicalParameterValue(
  parameter: ShotVideoTakeModelChoiceReport['parameters'][number],
  value: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>[string]
): NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>[string] {
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



function contextWithProductionOverride(input: {
  context: ShotVideoTakeGenerationContext;
  production?: ShotVideoTakeGenerationProduction;
}): ShotVideoTakeGenerationContext {
  if (!input.production) {
    return input.context;
  }
  return {
    ...input.context,
    takeGeneration: {
      ...input.context.takeGeneration,
      production: input.production,
    },
  };
}



export function validatePreflight(context: ShotVideoTakeGenerationContext): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const plan = context.takeGeneration.production;
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
        ['takeGeneration', 'production', 'inputModeId'],
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
          ['takeGeneration', 'production', 'agentProposal', 'basedOnInputModeId'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
    if (plan.agentProposal.basedOnModelChoice !== modelChoice) {
      issues.push(
        issue(
          'PROJECT_DATA377',
          'Shot video take agent proposal is stale for the current model.',
          ['takeGeneration', 'production', 'agentProposal', 'basedOnModelChoice'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
    if (
      plan.agentProposal.basedOnShotIds &&
      !sameShotIds(plan.agentProposal.basedOnShotIds, context.takeGeneration.shotIds)
    ) {
      issues.push(
        issue(
          'PROJECT_DATA378',
          'Shot video take agent proposal is stale for the current shot group.',
          ['takeGeneration', 'production', 'agentProposal', 'basedOnShotIds'],
          'Refresh the proposal before creating specs.'
        )
      );
    }
  }
  return issues;
}



export function agentBrief(context: ShotVideoTakeGenerationContext): string {
  return [
    `Scene: ${context.scene.title}`,
    `Shots: ${context.shots.map((shot) => `${shot.shotId}: ${shot.action}`).join(' | ')}`,
    `Input mode: ${context.takeGeneration.production.inputModeId ?? context.defaults.inputModeId}`,
    `Shot group mode: ${context.shotGroupMode}`,
  ].join('\n');
}
