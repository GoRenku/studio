import type { JsonValue } from '@gorenku/studio-core/client';

const JSON_POINTER = /^(?:\/(?:[^~/]|~[01])*)+$/;

export function isJsonPointer(value: string): boolean {
  return JSON_POINTER.test(value);
}

export function jsonPointerSegments(pointer: string): string[] {
  return pointer.split('/').slice(1).map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function jsonPointerChild(parent: string, key: string): string {
  return `${parent}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}

/** The value at `pointer`, or undefined when any segment is missing. */
export function readJsonPointer(value: JsonValue | undefined, pointer: string): JsonValue | undefined {
  let current = value;
  for (const segment of jsonPointerSegments(pointer)) {
    if (Array.isArray(current) && /^(?:0|[1-9]\d*)$/.test(segment)) current = current[Number(segment)];
    else if (current !== null && typeof current === 'object' && !Array.isArray(current) && Object.hasOwn(current, segment)) current = current[segment];
    else return undefined;
  }
  return current;
}

/** A minimal native request holding `value` at `pointer`, for Core safety checks. */
export function nativeControlEnvelope(pointer: string, value: JsonValue): JsonValue {
  return jsonPointerSegments(pointer).reduceRight<JsonValue>((request, segment) => ({ [segment]: request }), value);
}

/** A copy of `value` with the member at `pointer` omitted, preserving unrelated members. */
export function removeJsonPointer(value: JsonValue, pointer: string): JsonValue {
  const [segment, ...rest] = jsonPointerSegments(pointer);
  if (segment === undefined || value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) return value;
  const childPointer = `/${rest.map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
  if (Array.isArray(value)) {
    if (!/^(?:0|[1-9]\d*)$/.test(segment)) return value;
    const copy = [...value];
    if (rest.length === 0) copy.splice(Number(segment), 1);
    else copy[Number(segment)] = removeJsonPointer(copy[Number(segment)]!, childPointer);
    return copy;
  }
  const copy = { ...value };
  if (rest.length === 0) delete copy[segment];
  else copy[segment] = removeJsonPointer(copy[segment]!, childPointer);
  return copy;
}

/** A copy of `value` with `replacement` written at `pointer`, creating missing object members. */
export function writeJsonPointer(value: JsonValue, pointer: string, replacement: JsonValue): JsonValue {
  const [segment, ...rest] = jsonPointerSegments(pointer);
  if (segment === undefined) return replacement;
  const child = (current: JsonValue | undefined) => rest.length === 0
    ? replacement
    : writeJsonPointer(current ?? {}, `/${rest.map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`, replacement);
  if (Array.isArray(value) && /^(?:0|[1-9]\d*)$/.test(segment)) {
    const copy = [...value];
    copy[Number(segment)] = child(copy[Number(segment)]);
    return copy;
  }
  const record = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { ...record, [segment]: child(record[segment]) };
}
