import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type SceneShotVideoTakeProductionState,
  type ShotVideoTakeInputModeId,
  type ShotVideoTakeModelChoice,
  type ShotVideoTakeModelChoiceReport,
  type ShotVideoTakeOutputGenerationSpec,
  type ShotVideoTakePreflightInput,
  type ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  modelChoices,
} from './model-list.js';
import {
  filterPreparedInputsByReferenceInclusions,
} from './reference-inclusions.js';
import {
  durationSeconds,
} from './route-settings.js';

export function buildShotVideoTakeFinalSpec(input: {
  context: ShotVideoTakeProductionContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  parameterValues?: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>;
  promptMode?: 'require-authored' | 'estimate-placeholder';
}): ShotVideoTakeOutputGenerationSpec {
  const plan = input.context.take.state.production;
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

function parameterValuesForFinalTake(
  context: ShotVideoTakeProductionContext,
  inputModeId: ShotVideoTakeInputModeId,
  modelChoice: ShotVideoTakeModelChoice
): NonNullable<SceneShotVideoTakeProductionState['parameterValues']> {
  const report = modelChoices(context, inputModeId).find(
    (model) => model.modelChoice === modelChoice
  );
  if (!report) {
    return {};
  }
  const values: NonNullable<SceneShotVideoTakeProductionState['parameterValues']> = {};
  const planValues = context.take.state.production.parameterValues ?? {};
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
  value: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>[string]
): NonNullable<SceneShotVideoTakeProductionState['parameterValues']>[string] {
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
