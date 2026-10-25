import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { assertValidJsonSchema } from '../../shared/json-schema-validation.js';
import { PROVIDER_CATALOG_MAX_AGE_MS, retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';
import { isJsonObject } from '../../shared/json-object.js';

export const PIKA_ORIGIN = 'https://api.dev.pika.art';

export type PikaMediaCategory = 'image' | 'video' | 'audio';

export interface PikaOperationMetadata {
  apiId: string;
  category: PikaMediaCategory;
  path: string;
  inputSchema: JsonValue;
}

export async function loadPikaOperationMetadata(
  model: string,
  context: ProviderContext,
): Promise<PikaOperationMetadata> {
  if (!isExactPikaApiId(model)) {
    throw new EngineError(
      'ENGINE_METADATA_UNAVAILABLE',
      'Pika operation id must be an exact non-empty catalog api_id.',
      { provider: 'pika', model },
    );
  }
  const body = (await loadPikaCatalogRecord(model, context)).body;
  if (!isJsonObject(body)) {
    throw invalidMetadata(model);
  }
  if (body.api_id !== model) {
    throw invalidMetadata(model);
  }
  if (!isPikaMediaCategory(body.category)) {
    throw new EngineError(
      'ENGINE_METADATA_INVALID',
      `Pika operation "${model}" is not an asynchronous media operation.`,
      { provider: 'pika', model },
    );
  }
  if (!isJsonObject(body.call) || body.call.method !== 'POST') {
    throw invalidMetadata(model);
  }
  const path = body.call.path;
  if (typeof path !== 'string' || !isSafeMediaPath(path)) {
    throw invalidMetadata(model);
  }
  if (!isJsonObject(body.input_schema)) {
    throw invalidMetadata(model);
  }
  assertValidJsonSchema({ provider: 'pika', model, schema: body.input_schema });
  return {
    apiId: model,
    category: body.category,
    path,
    inputSchema: body.input_schema,
  };
}

/** The catalog record of one operation; its input schema and display pricing share one cached read. */
export function loadPikaCatalogRecord(model: string, context: ProviderContext) {
  return retrieveProviderMetadata({
    key: { provider: 'pika', model, url: `${PIKA_ORIGIN}/catalog/apis/${model}?expand=inputs` },
    context,
    defaultMaxAgeMs: PROVIDER_CATALOG_MAX_AGE_MS,
  });
}

function isSafeMediaPath(path: string): boolean {
  if (!path.startsWith('/v1/media/') || path.includes('%') || path.includes('\\')) {
    return false;
  }
  try {
    const resolved = new URL(path, PIKA_ORIGIN);
    return resolved.origin === PIKA_ORIGIN
      && resolved.pathname === path
      && resolved.search === ''
      && resolved.hash === '';
  } catch {
    return false;
  }
}

function isExactPikaApiId(model: string): boolean {
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(model)) {
    return false;
  }
  return model.split('/').every((segment) => segment !== '.' && segment !== '..');
}

function isPikaMediaCategory(value: JsonValue | undefined): value is PikaMediaCategory {
  return value === 'image' || value === 'video' || value === 'audio';
}

function invalidMetadata(model: string): EngineError {
  return new EngineError(
    'ENGINE_METADATA_INVALID',
    `Pika metadata for "${model}" does not contain a valid asynchronous media contract.`,
    { provider: 'pika', model },
  );
}
