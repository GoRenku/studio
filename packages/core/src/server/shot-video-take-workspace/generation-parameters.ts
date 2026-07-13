import type {
  GenerationModelDescriptor,
  JsonValue,
} from '../../client/generation.js';

type GenerationModelField = GenerationModelDescriptor['fields'][number];

const FIELD_ORDER = new Map([
  ['duration', 0],
  ['aspect_ratio', 1],
  ['resolution', 2],
  ['generate_audio', 3],
  ['seed', 4],
]);

export function isShotVideoTakeGenerationParameter(
  field: GenerationModelField
): boolean {
  return !field.media &&
    field.semantic?.kind !== 'authored-text' &&
    field.name !== 'end_user_id';
}

export function orderShotVideoTakeGenerationParameters(
  fields: GenerationModelField[]
): GenerationModelField[] {
  return [...fields].sort((left, right) =>
    (FIELD_ORDER.get(left.name) ?? Number.MAX_SAFE_INTEGER) -
      (FIELD_ORDER.get(right.name) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function shotVideoTakeParameterAllowedValues(
  field: GenerationModelField
): GenerationModelField['allowedValues'] {
  if (!isDurationField(field)) {
    return field.allowedValues;
  }
  return field.allowedValues?.filter((value) => durationSeconds(value) !== null);
}

export function shotVideoTakeParameterDefaultValue(
  field: GenerationModelField
): JsonValue | undefined {
  if (!isDurationField(field)) {
    return field.defaultValue;
  }
  const allowedValues = shotVideoTakeParameterAllowedValues(field) ?? [];
  const lowestAllowed = [...allowedValues].sort(
    (left, right) => durationSeconds(left)! - durationSeconds(right)!
  )[0];
  return lowestAllowed ?? field.minimum;
}

export function normalizeShotVideoTakeParameterValues(input: {
  fields: GenerationModelField[];
  values: Record<string, JsonValue>;
}): Record<string, JsonValue> {
  const values = { ...input.values };
  const durationField = input.fields.find(isDurationField);
  if (!durationField) {
    return values;
  }
  const currentDuration = values[durationField.name];
  if (
    currentDuration !== undefined &&
    durationValueIsAllowed(durationField, currentDuration)
  ) {
    return values;
  }
  if (currentDuration !== undefined && durationSeconds(currentDuration) !== null) {
    const defaultDuration = shotVideoTakeParameterDefaultValue(durationField);
    if (defaultDuration !== undefined) {
      values[durationField.name] = defaultDuration;
    }
    return values;
  }
  if (
    currentDuration !== undefined &&
    currentDuration !== durationField.defaultValue &&
    currentDuration !== 'auto'
  ) {
    return values;
  }
  const defaultDuration = shotVideoTakeParameterDefaultValue(durationField);
  if (defaultDuration !== undefined) {
    values[durationField.name] = defaultDuration;
  }
  return values;
}

export function durationSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d+(?:\.\d+)?)s?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const duration = Number(match[1]);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function isDurationField(field: GenerationModelField): boolean {
  return field.semantic?.kind === 'setting' && field.semantic.role === 'duration';
}

function durationValueIsAllowed(
  field: GenerationModelField,
  value: JsonValue
): boolean {
  const duration = durationSeconds(value);
  if (duration === null) {
    return false;
  }
  const allowedDurations = shotVideoTakeParameterAllowedValues(field)?.map(
    (allowed) => durationSeconds(allowed)
  );
  if (allowedDurations?.length) {
    return allowedDurations.includes(duration);
  }
  return (
    (field.minimum === undefined || duration >= field.minimum) &&
    (field.maximum === undefined || duration <= field.maximum)
  );
}
