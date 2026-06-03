import type {
  ShotVideoRoute,
  ShotVideoRouteParameter,
  ShotVideoTakeRouteParameterValue,
} from './shot-video-model-families.js';

export interface ShotVideoRouteSettingsNormalization {
  values: Record<string, ShotVideoTakeRouteParameterValue>;
  providerValues: Record<string, ShotVideoTakeRouteParameterValue>;
  droppedSettingIds: string[];
  invalidSettingIds: string[];
}

export function normalizeShotVideoRouteSettings(input: {
  route: ShotVideoRoute;
  defaults?: Record<string, ShotVideoTakeRouteParameterValue | undefined>;
  settings?: Record<string, ShotVideoTakeRouteParameterValue | undefined>;
}): ShotVideoRouteSettingsNormalization {
  const values: Record<string, ShotVideoTakeRouteParameterValue> = {};
  const providerValues: Record<string, ShotVideoTakeRouteParameterValue> = {};
  const invalidSettingIds: string[] = [];
  const routeParameters = new Map(input.route.parameters.map((parameter) => [parameter.id, parameter]));

  for (const parameter of input.route.parameters) {
    const raw =
      input.settings?.[parameter.id] ??
      input.defaults?.[parameter.id] ??
      parameter.defaultValue;
    if (raw === undefined) {
      continue;
    }
    const normalized = normalizeParameterValue(parameter, raw);
    if (normalized.valid) {
      values[parameter.id] = normalized.value;
      providerValues[parameter.providerField] = normalized.value;
    } else {
      invalidSettingIds.push(parameter.id);
    }
  }

  const droppedSettingIds = Object.keys(input.settings ?? {}).filter(
    (settingId) => !routeParameters.has(settingId)
  );

  return { values, providerValues, droppedSettingIds, invalidSettingIds };
}

function normalizeParameterValue(
  parameter: ShotVideoRouteParameter,
  value: ShotVideoTakeRouteParameterValue
): { valid: true; value: ShotVideoTakeRouteParameterValue } | { valid: false } {
  if (!parameter.allowedValues?.length) {
    if (typeof value === 'number') {
      if (parameter.minimum !== undefined && value < parameter.minimum) {
        return { valid: false };
      }
      if (parameter.maximum !== undefined && value > parameter.maximum) {
        return { valid: false };
      }
    }
    return { valid: true, value };
  }
  const exact = parameter.allowedValues.find((allowed) => allowed === value);
  if (exact !== undefined) {
    return { valid: true, value: exact };
  }
  const stringMatch = parameter.allowedValues.find(
    (allowed) => String(allowed) === String(value)
  );
  if (stringMatch !== undefined) {
    return { valid: true, value: stringMatch };
  }
  if (parameter.id === 'duration') {
    const seconds = durationSeconds(value);
    if (seconds === null) {
      return { valid: false };
    }
    const durationMatch = parameter.allowedValues.find(
      (allowed) => durationSeconds(allowed) === seconds
    );
    if (durationMatch !== undefined) {
      return { valid: true, value: durationMatch };
    }
  }
  return { valid: false };
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
