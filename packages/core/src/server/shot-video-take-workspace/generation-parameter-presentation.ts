import type { GenerationModelDescriptor } from '../../client/generation.js';

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
  if (field.semantic?.kind !== 'setting' || field.semantic.role !== 'duration') {
    return field.allowedValues;
  }
  return field.allowedValues?.filter((value) => value !== 'auto');
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
