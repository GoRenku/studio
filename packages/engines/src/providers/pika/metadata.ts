import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { assertValidJsonSchema } from '../../shared/json-schema-validation.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';

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
  const url = `${PIKA_ORIGIN}/catalog/apis/${model}?expand=inputs`;
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'pika', model, url },
    context,
  });
  const body = metadata.body;
  if (!isRecord(body)) {
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
  if (!isRecord(body.call) || body.call.method !== 'POST') {
    throw invalidMetadata(model);
  }
  const path = body.call.path;
  if (typeof path !== 'string' || !isSafeMediaPath(path)) {
    throw invalidMetadata(model);
  }
  if (!isRecord(body.input_schema)) {
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

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
