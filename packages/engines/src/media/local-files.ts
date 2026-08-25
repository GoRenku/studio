import { readFile, stat } from 'node:fs/promises';
import type { JsonValue, LocalMediaFile } from './contracts.js';
import { EngineError } from '../shared/errors.js';

export interface ResolvedLocalMediaFile extends LocalMediaFile {
  bytes: Uint8Array;
}

export function isLocalMediaFile(value: unknown): value is LocalMediaFile {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.every((key) => (
    key === '$file'
    || key === 'mimeType'
    || key === 'reviewLabel'
    || key === 'promptMention'
  ))
    && typeof record.$file === 'string'
    && record.$file.length > 0
    && (record.mimeType === undefined || typeof record.mimeType === 'string')
    && (record.reviewLabel === undefined || typeof record.reviewLabel === 'string')
    && (record.promptMention === undefined || typeof record.promptMention === 'string');
}

export function findLocalMediaFiles(value: JsonValue): LocalMediaFile[] {
  const markers: LocalMediaFile[] = [];
  visit(value, (marker) => markers.push(marker));
  return markers;
}

export async function substituteLocalMediaFiles(
  value: JsonValue,
  provider: string,
  model: string,
  upload: (file: ResolvedLocalMediaFile) => Promise<string>,
): Promise<JsonValue> {
  assertValidLocalMediaMarker(value, provider, model);
  if (isLocalMediaFile(value)) {
    const file = await resolveLocalFile(value, provider, model);
    try {
      return await upload(file);
    } catch (error) {
      if (error instanceof EngineError) {
        throw error;
      }
      throw new EngineError(
        'ENGINE_UPLOAD_FAILED',
        `Could not upload local media for ${provider}/${model}.`,
        { provider, model, cause: error },
      );
    }
  }
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((entry) => substituteLocalMediaFiles(entry, provider, model, upload)),
    );
  }
  if (value !== null && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, entry]) => [
        key,
        await substituteLocalMediaFiles(entry, provider, model, upload),
      ] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

export function replaceLocalMediaFilesWithValidationUrls(value: JsonValue): JsonValue {
  assertValidLocalMediaMarker(value, 'engines');
  if (isLocalMediaFile(value)) {
    return `https://local-media.invalid/${encodeURIComponent(value.$file)}`;
  }
  if (Array.isArray(value)) {
    return value.map(replaceLocalMediaFilesWithValidationUrls);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceLocalMediaFilesWithValidationUrls(entry),
      ]),
    );
  }
  return value;
}

function visit(value: JsonValue, onMarker: (marker: LocalMediaFile) => void): void {
  assertValidLocalMediaMarker(value, 'engines');
  if (isLocalMediaFile(value)) {
    onMarker(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => visit(entry, onMarker));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((entry) => visit(entry, onMarker));
  }
}

function assertValidLocalMediaMarker(
  value: JsonValue,
  provider: string,
  model?: string,
): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }
  const record = value as Record<string, JsonValue>;
  if (!Object.hasOwn(record, '$file')) {
    return;
  }
  const keys = Object.keys(record);
  const markerKeysOnly = keys.every((key) => (
    key === '$file'
    || key === 'mimeType'
    || key === 'reviewLabel'
    || key === 'promptMention'
  ));
  if (markerKeysOnly && !isLocalMediaFile(value)) {
    throw new EngineError(
      'ENGINE_LOCAL_MEDIA_INVALID',
      'Local media markers require a non-empty $file string and string annotation values.',
      { provider, model },
    );
  }
}

async function resolveLocalFile(
  marker: LocalMediaFile,
  provider: string,
  model: string,
): Promise<ResolvedLocalMediaFile> {
  try {
    const fileStat = await stat(marker.$file);
    if (!fileStat.isFile()) {
      throw new Error('Path is not a regular file.');
    }
    return { ...marker, bytes: await readFile(marker.$file) };
  } catch (error) {
    throw new EngineError(
      'ENGINE_LOCAL_MEDIA_INVALID',
      `Local media file "${marker.$file}" cannot be read.`,
      { provider, model, cause: error },
    );
  }
}
