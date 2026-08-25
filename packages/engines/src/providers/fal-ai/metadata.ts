import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';

const OPEN_API_URL = 'https://fal.ai/api/openapi/queue/openapi.json';

export async function loadFalInputSchema(
  model: string,
  context: ProviderContext,
): Promise<JsonValue> {
  const url = `${OPEN_API_URL}?endpoint_id=${encodeURIComponent(normalizeModel(model))}`;
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'fal-ai', model, url },
    context,
  });
  const body = metadata.body;
  if (!isRecord(body) || !isRecord(body.paths) || !isRecord(body.components)) {
    throw invalidMetadata(model);
  }
  for (const path of Object.values(body.paths)) {
    if (!isRecord(path) || !isRecord(path.post)) {
      continue;
    }
    const schema = readPath(path.post, ['requestBody', 'content', 'application/json', 'schema']);
    if (isRecord(schema)) {
      return { ...schema, components: body.components } as JsonValue;
    }
  }
  throw invalidMetadata(model);
}

export function normalizeModel(model: string): string {
  return model.startsWith('fal-ai/') ? model : `fal-ai/${model}`;
}

function invalidMetadata(model: string): EngineError {
  return new EngineError(
    'ENGINE_METADATA_INVALID',
    `Fal.ai metadata for ${model} does not contain an input schema.`,
    { provider: 'fal-ai', model },
  );
}

function readPath(value: Record<string, JsonValue>, path: string[]): JsonValue | undefined {
  let current: JsonValue = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
