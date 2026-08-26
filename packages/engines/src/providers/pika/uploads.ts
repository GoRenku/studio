import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type {
  JsonValue,
  LocalMediaFile,
  ProviderExecutionContext,
  ProviderRequest,
} from '../../media/contracts.js';
import {
  findLocalMediaFiles,
  isLocalMediaFile,
  substituteLocalMediaFiles,
  type ResolvedLocalMediaFile,
} from '../../media/local-files.js';
import { EngineError } from '../../shared/errors.js';
import { createRequestTimeoutFetch } from '../../shared/request-timeout.js';
import { withProviderRetries } from '../../shared/retry.js';
import { pikaHttpError, readPikaResponseBody } from './errors.js';
import { PIKA_ORIGIN, type PikaMediaCategory } from './metadata.js';

const INPUT_SIZE_LIMITS: Record<PikaMediaCategory, number> = {
  image: 20 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

interface PreflightFile {
  marker: LocalMediaFile;
  mimeType: string;
  mediaKind: PikaMediaCategory;
  sizeBytes: number;
}

interface UploadGrant {
  uploadUrl: string;
  hostedUrl: string;
  headers: Record<string, string>;
}

export async function preflightPikaLocalMedia(input: {
  request: ProviderRequest;
  schema: JsonValue;
}): Promise<PreflightFile[]> {
  const markers = findLocalMediaFiles(input.request.input);
  validateMarkerSchemaLocations(input.request.input, input.schema, input.schema, input.request.model);
  return Promise.all(markers.map(async (marker) => {
    const mimeType = resolveMimeType(marker);
    const mediaKind = mediaKindForMime(mimeType, input.request.model);
    let sizeBytes: number;
    try {
      const file = await stat(marker.$file);
      if (!file.isFile()) {
        throw new Error('Path is not a regular file.');
      }
      sizeBytes = file.size;
    } catch {
      throw new EngineError(
        'ENGINE_LOCAL_MEDIA_INVALID',
        'A Pika local media input cannot be read.',
        { provider: 'pika', model: input.request.model },
      );
    }
    if (sizeBytes <= 0 || sizeBytes > INPUT_SIZE_LIMITS[mediaKind]) {
      throw new EngineError(
        'ENGINE_LOCAL_MEDIA_INVALID',
        `Pika ${mediaKind} inputs must be non-empty and no larger than ${INPUT_SIZE_LIMITS[mediaKind]} bytes.`,
        { provider: 'pika', model: input.request.model },
      );
    }
    return { marker, mimeType, mediaKind, sizeBytes };
  }));
}

export async function uploadPikaLocalMedia(input: {
  request: ProviderRequest;
  context: ProviderExecutionContext;
  preflight: PreflightFile[];
}): Promise<JsonValue> {
  try {
    return await substituteLocalMediaFiles(
      input.request.input,
      'pika',
      input.request.model,
      async (file) => {
        const checked = input.preflight.find((entry) => (
          entry.marker.$file === file.$file
            && entry.mimeType === resolveMimeType(file)
        ));
        if (!checked || checked.sizeBytes !== file.bytes.byteLength) {
          throw new EngineError(
            'ENGINE_LOCAL_MEDIA_INVALID',
            'A Pika local media input changed after validation.',
            { provider: 'pika', model: input.request.model },
          );
        }
        return uploadFile(file, checked.mimeType, input.request.model, input.context);
      },
    );
  } catch (error) {
    if (error instanceof EngineError
      && error.code === 'ENGINE_LOCAL_MEDIA_INVALID'
      && error.httpStatus === undefined) {
      throw new EngineError(
        error.code,
        'A Pika local media input is invalid or cannot be read.',
        { provider: 'pika', model: input.request.model },
      );
    }
    throw error;
  }
}

async function uploadFile(
  file: ResolvedLocalMediaFile,
  mimeType: string,
  model: string,
  context: ProviderExecutionContext,
): Promise<string> {
  const grant = await requestUploadGrant(mimeType, file.bytes.byteLength, model, context);
  let response: Response;
  try {
    response = await createRequestTimeoutFetch({ provider: 'pika', model, context })(
      grant.uploadUrl,
      {
        method: 'PUT',
        headers: grant.headers,
        body: file.bytes,
        redirect: 'error',
        signal: context.signal,
      },
    );
  } catch {
    throw new EngineError(
      context.signal.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_UPLOAD_FAILED',
      'Pika signed media upload could not be completed.',
      { provider: 'pika', model, retryable: false },
    );
  }
  if (!response.ok) {
    throw new EngineError(
      'ENGINE_UPLOAD_FAILED',
      `Pika signed media upload failed with HTTP ${response.status}.`,
      { provider: 'pika', model, httpStatus: response.status },
    );
  }
  return grant.hostedUrl;
}

async function requestUploadGrant(
  mimeType: string,
  sizeBytes: number,
  model: string,
  context: ProviderExecutionContext,
): Promise<UploadGrant> {
  const response = await withProviderRetries({
    provider: 'pika',
    model,
    context,
    maxAttempts: 3,
    operation: async () => {
      let result: Response;
      try {
        result = await createRequestTimeoutFetch({ provider: 'pika', model, context })(
          `${PIKA_ORIGIN}/v1/media/uploads`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': context.credential,
            },
            body: JSON.stringify({ content_type: mimeType, size_bytes: sizeBytes }),
            redirect: 'error',
            signal: context.signal,
          },
        );
      } catch (error) {
        if (error instanceof EngineError) {
          throw error;
        }
        throw new EngineError(
          context.signal.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_UPLOAD_FAILED',
          'Pika media upload authorization could not be completed.',
          {
            provider: 'pika',
            model,
            retryable: !context.signal.aborted,
            cause: error,
          },
        );
      }
      if (!result.ok) {
        throw pikaHttpError({
          response: result,
          model,
          fallbackCode: 'ENGINE_UPLOAD_FAILED',
          operation: 'upload',
        });
      }
      return result;
    },
    classify: retryDecision,
  });
  const value = await readPikaResponseBody(response);
  if (!isRecord(value)
    || typeof value.upload_url !== 'string'
    || typeof value.url !== 'string'
    || !isStringRecord(value.headers)
    || !isHttpsUrl(value.upload_url)
    || !isHttpsUrl(value.url)) {
    throw new EngineError(
      'ENGINE_UPLOAD_FAILED',
      'Pika returned an invalid media upload grant.',
      { provider: 'pika', model },
    );
  }
  return { uploadUrl: value.upload_url, hostedUrl: value.url, headers: value.headers };
}

function retryDecision(error: unknown): { retryable: boolean; retryAfterMs?: number } {
  return error instanceof EngineError
    ? { retryable: error.retryable, retryAfterMs: error.retryAfterMs }
    : { retryable: false };
}

function validateMarkerSchemaLocations(
  value: JsonValue,
  schema: JsonValue,
  rootSchema: JsonValue,
  model: string,
): void {
  if (isLocalMediaFile(value)) {
    const allowedKinds = collectMediaKinds(schema, rootSchema);
    const mediaKind = mediaKindForMime(resolveMimeType(value), model);
    if (!allowedKinds.includes(mediaKind)) {
      throw new EngineError(
        'ENGINE_LOCAL_MEDIA_INVALID',
        `Pika local ${mediaKind} media is not accepted at this request field.`,
        { provider: 'pika', model },
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    const schemas = childSchemas(schema, 'items', rootSchema);
    value.forEach((entry) => {
      if (schemas.length === 0 && containsLocalMarker(entry)) {
        throw new EngineError(
          'ENGINE_LOCAL_MEDIA_INVALID',
          'Pika local media must appear in a schema field annotated with media_kinds.',
          { provider: 'pika', model },
        );
      }
      validateMarkerSchemaLocations(entry, combineSchemas(schemas), rootSchema, model);
    });
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const schemas = propertySchemas(schema, key, rootSchema);
    if (schemas.length === 0 && containsLocalMarker(entry)) {
      throw new EngineError(
        'ENGINE_LOCAL_MEDIA_INVALID',
        'Pika local media must appear in a schema field annotated with media_kinds.',
        { provider: 'pika', model },
      );
    }
    validateMarkerSchemaLocations(entry, combineSchemas(schemas), rootSchema, model);
  }
}

function propertySchemas(schema: JsonValue, key: string, root: JsonValue): JsonValue[] {
  const schemas = expandSchemas(schema, root);
  const matches: JsonValue[] = [];
  for (const candidate of schemas) {
    if (isRecord(candidate.properties) && candidate.properties[key] !== undefined) {
      matches.push(candidate.properties[key]);
    } else if (isRecord(candidate.additionalProperties)) {
      matches.push(candidate.additionalProperties);
    }
  }
  return matches;
}

function childSchemas(schema: JsonValue, key: 'items', root: JsonValue): JsonValue[] {
  return expandSchemas(schema, root).flatMap((candidate) => (
    candidate[key] === undefined ? [] : [candidate[key]]
  ));
}

function collectMediaKinds(schema: JsonValue, root: JsonValue): PikaMediaCategory[] {
  const kinds = new Set<PikaMediaCategory>();
  for (const candidate of expandSchemas(schema, root)) {
    if (!Array.isArray(candidate.media_kinds)) {
      continue;
    }
    candidate.media_kinds.forEach((kind) => {
      if (kind === 'image' || kind === 'video' || kind === 'audio') {
        kinds.add(kind);
      }
    });
  }
  return [...kinds];
}

function combineSchemas(schemas: JsonValue[]): JsonValue {
  return schemas.length === 1 ? schemas[0]! : { anyOf: schemas };
}

function expandSchemas(schema: JsonValue, root: JsonValue, seen = new Set<JsonValue>()): Record<string, JsonValue>[] {
  if (!isRecord(schema) || seen.has(schema)) {
    return [];
  }
  seen.add(schema);
  const schemas = [schema];
  if (typeof schema.$ref === 'string') {
    const resolved = resolveLocalReference(schema.$ref, root);
    if (resolved !== undefined) {
      schemas.push(...expandSchemas(resolved, root, seen));
    }
  }
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    if (Array.isArray(schema[key])) {
      schema[key].forEach((entry) => schemas.push(...expandSchemas(entry, root, seen)));
    }
  }
  return schemas;
}

function resolveLocalReference(reference: string, root: JsonValue): JsonValue | undefined {
  if (!reference.startsWith('#/')) {
    return undefined;
  }
  let value: JsonValue | undefined = root;
  for (const segment of reference.slice(2).split('/')) {
    if (!isRecord(value)) {
      return undefined;
    }
    value = value[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return value;
}

function containsLocalMarker(value: JsonValue): boolean {
  return findLocalMediaFiles(value).length > 0;
}

function resolveMimeType(marker: LocalMediaFile): string {
  const provided = marker.mimeType?.split(';')[0]?.trim().toLowerCase();
  if (provided) {
    return provided;
  }
  const extensions: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
  };
  const inferred = extensions[extname(marker.$file).toLowerCase()];
  if (!inferred) {
    throw new EngineError(
      'ENGINE_LOCAL_MEDIA_INVALID',
      'Pika local media requires a recognized MIME type.',
      { provider: 'pika' },
    );
  }
  return inferred;
}

function mediaKindForMime(mimeType: string, model: string): PikaMediaCategory {
  const kind = mimeType.split('/', 1)[0];
  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return kind;
  }
  throw new EngineError(
    'ENGINE_LOCAL_MEDIA_INVALID',
    `Pika does not accept local media with MIME type "${mimeType}".`,
    { provider: 'pika', model },
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isStringRecord(value: JsonValue | undefined): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
