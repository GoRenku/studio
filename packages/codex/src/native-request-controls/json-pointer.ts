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
