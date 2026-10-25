import type { JsonValue } from '../media/contracts.js';

/** A JSON object, as opposed to an array, null or a scalar. */
export function isJsonObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** An object of unknown origin, before its fields are checked. */
export function isUnknownObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A value that survives JSON serialization unchanged: finite numbers and at most 100 levels deep. */
export function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 100) {
    return false;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry, depth + 1));
  }
  return isUnknownObject(value)
    && Object.values(value).every((entry) => isJsonValue(entry, depth + 1));
}
