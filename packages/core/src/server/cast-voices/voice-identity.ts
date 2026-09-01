import path from 'node:path';
import type { JsonValue } from '../../client/json.js';
import { ProjectDataError } from '../project-data-error.js';

const MAX_VOICE_IDENTITY_BYTES = 64 * 1024;
const MAX_VOICE_IDENTITY_DEPTH = 16;
const SECRET_FIELD = /^(?:authorization|cookie|set-cookie|api[-_]?key|token|access[-_]?token|secret|credential|password)$/i;
const SIGNED_QUERY_FIELD = /^(?:x-amz-signature|x-amz-credential|signature|sig|token|access_token|key-pair-id|policy)$/i;

export function validateVoiceIdentity(value: JsonValue | undefined): JsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = requireJsonValue(value, [], 0);
  const size = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
  if (size > MAX_VOICE_IDENTITY_BYTES) {
    throw invalid(`Cast Voice identity exceeds ${MAX_VOICE_IDENTITY_BYTES} bytes.`);
  }
  return normalized;
}

function requireJsonValue(
  value: JsonValue,
  pathSegments: Array<string | number>,
  depth: number,
): JsonValue {
  if (depth > MAX_VOICE_IDENTITY_DEPTH) {
    throw invalid(`Cast Voice identity exceeds maximum depth at ${formatPath(pathSegments)}.`);
  }
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw invalid(`Cast Voice identity has a non-finite number at ${formatPath(pathSegments)}.`);
    }
    return value;
  }
  if (typeof value === 'string') {
    assertSafeString(value, pathSegments);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => requireJsonValue(entry, [...pathSegments, index], depth + 1));
  }
  const entries = Object.entries(value);
  return Object.fromEntries(entries.map(([key, entry]) => {
    if (SECRET_FIELD.test(key)) {
      throw invalid(`Secret-bearing field is not allowed at ${formatPath([...pathSegments, key])}.`);
    }
    return [key, requireJsonValue(entry, [...pathSegments, key], depth + 1)];
  }));
}

function assertSafeString(value: string, pathSegments: Array<string | number>): void {
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw invalid(`Absolute local path is not allowed at ${formatPath(pathSegments)}.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (
    url.username
    || url.password
    || [...url.searchParams.keys()].some((key) => SIGNED_QUERY_FIELD.test(key))
  ) {
    throw invalid(`Credential-bearing URL is not allowed at ${formatPath(pathSegments)}.`);
  }
}

function invalid(message: string): ProjectDataError {
  return new ProjectDataError('CORE_CAST_VOICE_IDENTITY_INVALID', message);
}

function formatPath(pathSegments: Array<string | number>): string {
  return pathSegments.length === 0 ? '(root)' : pathSegments.join('.');
}
