import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationProduction,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakePreflightInput,
  ShotVideoTakeShotGroupMode,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import {
  normalizeShotVideoRouteSettings,
  selectShotVideoRoute,
} from '@gorenku/studio-engines';
import type {
  ShotVideoRoute,
  ShotVideoRouteInputSlot,
} from '@gorenku/studio-engines';



export function normalizeRouteSettingsForContext(input: {
  context: ShotVideoTakeGenerationContext;
  route: ShotVideoRoute;
}) {
  return normalizeShotVideoRouteSettings({
    route: input.route,
    defaults: input.context.defaults.parameterValues,
    settings: input.context.takeGeneration.production.parameterValues,
  }) as {
    values: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>;
    providerValues: NonNullable<ShotVideoTakeGenerationProduction['parameterValues']>;
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
  input: ShotVideoTakeGenerationSpec['inputs'][number],
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
      'multi-shot-storyboard-sheet',
    ].includes(input.kind)
  );
}



export function missingRequiredRouteInputLabelsForFinalSpec(input: {
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



export function missingRequiredRouteInputLabelsForPreparedInputs(input: {
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
      'multi-shot-storyboard-sheet',
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
  const route = selectShotVideoRoute({ modelChoice, inputMode: inputModeId, shotGroupMode });
  if (!route) {
    throw new ProjectDataError(
      'PROJECT_DATA386',
      `Shot video take model does not support the selected input mode and shot group mode: ${modelChoice} / ${inputModeId} / ${shotGroupMode}.`
    );
  }
  return route;
}
