import type {
  ShotVideoTakeProductionContext,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeOutputGenerationSpec,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakePreflightInput,
  ShotVideoTakeShotGroupMode,
} from '../../../../../client/index.js';
import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import {
  normalizeShotVideoRouteSettings,
  selectShotVideoRoute,
} from '@gorenku/studio-engines';
import type {
  ShotVideoRoute,
  ShotVideoRouteInputSlot,
} from '@gorenku/studio-engines';
import {
  issue,
} from './diagnostics.js';



export function normalizeRouteSettingsForContext(input: {
  context: ShotVideoTakeProductionContext;
  route: ShotVideoRoute;
}) {
  return normalizeShotVideoRouteSettings({
    route: input.route,
    defaults: input.context.defaults.parameterValues,
    settings: input.context.take.state.production.parameterValues,
  }) as {
    values: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>;
    providerValues: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>;
    droppedSettingIds: string[];
    invalidSettingIds: string[];
  };
}



export function inputRolesForRoute(
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



export function parametersForRoute(
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



export function durationSupportForRoute(
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



export function finalInputMatchesRouteSlot(
  input: ShotVideoTakeOutputGenerationSpec['inputs'][number],
  slot: ShotVideoRouteInputSlot
): boolean {
  if (input.mediaKind !== slot.mediaKind) {
    return false;
  }
  if (input.kind === slot.kind) {
    return true;
  }
  return (
    slot.kind === 'reference-image' &&
    [
      'character-sheet',
      'location-sheet',
      'lookbook-sheet',
      'video-prompt-sheet',
    ].includes(input.kind)
  );
}



export function missingRequiredRouteInputLabelsForFinalSpec(input: {
  context: ShotVideoTakeProductionContext;
  spec: ShotVideoTakeOutputGenerationSpec;
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



export function missingRequiredRouteInputLabelsForPreparedInputs(input: {
  context: ShotVideoTakeProductionContext;
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



export function preparedInputMatchesRouteSlot(
  input: ShotVideoTakePreflightInput,
  slot: ShotVideoRouteInputSlot
): boolean {
  if (input.mediaKind !== slot.mediaKind) {
    return false;
  }
  if (input.kind === slot.kind) {
    return true;
  }
  return (
    slot.kind === 'reference-image' &&
    [
      'character-sheet',
      'location-sheet',
      'lookbook-sheet',
      'video-prompt-sheet',
    ].includes(input.kind)
  );
}



export function routeInputSlotLabel(slot: ShotVideoRouteInputSlot): string {
  return slot.kind;
}



export function durationSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d+)(?:s)?$/.exec(value);
  return match ? Number(match[1]) : null;
}



export function requireShotVideoTakeRoute(
  modelChoice: ShotVideoTakeModelChoice,
  inputModeId: ShotVideoTakeInputModeId,
  shotGroupMode: ShotVideoTakeShotGroupMode
): ShotVideoRoute {
  const issues = validateShotVideoTakeRouteCompatibility({
    modelChoice,
    inputModeId,
    shotGroupMode,
  });
  if (issues.length > 0) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_ROUTE_UNSUPPORTED',
      `Shot video take model does not support the selected input mode and shot group mode: ${modelChoice} / ${inputModeId} / ${shotGroupMode}.`,
      {
        issues,
        suggestion:
          'Choose a model and input mode combination that supports the current shot group.',
      }
    );
  }
  const route = selectShotVideoRoute({ modelChoice, inputMode: inputModeId, shotGroupMode });
  if (!route) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_ROUTE_UNSUPPORTED',
      `Shot video take model does not support the selected input mode and shot group mode: ${modelChoice} / ${inputModeId} / ${shotGroupMode}.`
    );
  }
  return route;
}

export function validateShotVideoTakeRouteCompatibility(input: {
  modelChoice: ShotVideoTakeModelChoice;
  inputModeId: ShotVideoTakeInputModeId;
  shotGroupMode: ShotVideoTakeShotGroupMode;
}): DiagnosticIssue[] {
  const route = selectShotVideoRoute({
    modelChoice: input.modelChoice,
    inputMode: input.inputModeId,
    shotGroupMode: input.shotGroupMode,
  });
  if (route) {
    return [];
  }
  return [
    issue(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_ROUTE_UNSUPPORTED',
      `Shot video take model does not support the selected input mode and shot group mode: ${input.modelChoice} / ${input.inputModeId} / ${input.shotGroupMode}.`,
      ['production', 'inputModeId'],
      'Choose a model and input mode combination that supports the current shot group.'
    ),
    issue(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_ROUTE_UNSUPPORTED',
      `Shot video take input mode is unsupported by the selected model for this shot group: ${input.inputModeId}.`,
      ['production', 'modelChoice'],
      'Choose a model and input mode combination that supports the current shot group.'
    ),
  ];
}
