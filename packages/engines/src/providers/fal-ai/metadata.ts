import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';

const MODELS_URL = 'https://api.fal.ai/v1/models';

export async function loadFalInputSchema(
  model: string,
  context: ProviderContext,
): Promise<JsonValue> {
  assertExactFalEndpointId(model);
  const url = new URL(MODELS_URL);
  url.searchParams.set('endpoint_id', model);
  url.searchParams.set('expand', 'openapi-3.0');
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'fal-ai', model, url: url.toString() },
    context,
    headers: { Authorization: `Key ${context.credential}` },
  });
  const body = metadata.body;
  if (!isRecord(body) || !Array.isArray(body.models)) {
    throw invalidMetadata(model);
  }
  const selected = body.models.find(
    (entry) => isRecord(entry) && entry.endpoint_id === model,
  );
  if (!isRecord(selected)) {
    throw new EngineError(
      'ENGINE_METADATA_UNAVAILABLE',
      `Fal.ai endpoint "${model}" was not found in live provider metadata.`,
      { provider: 'fal-ai', model },
    );
  }
  const openApi = selected.openapi;
  if (!isRecord(openApi) || !isRecord(openApi.paths) || !isRecord(openApi.components)) {
    throw invalidMetadata(model);
  }
  const inputSchemas = Object.values(openApi.paths).flatMap((operation) => {
    if (!isRecord(operation) || !isRecord(operation.post)) {
      return [];
    }
    const schema = readPath(
      operation.post,
      ['requestBody', 'content', 'application/json', 'schema'],
    );
    return isRecord(schema) ? [schema] : [];
  });
  if (inputSchemas.length === 1) {
    return { ...inputSchemas[0], components: openApi.components } as JsonValue;
  }
  throw invalidMetadata(model);
}

function assertExactFalEndpointId(model: string): void {
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+$/.test(model)
    || model.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new EngineError(
      'ENGINE_REQUEST_INVALID',
      'Fal.ai model must be the exact provider endpoint id, including its namespace.',
      { provider: 'fal-ai', model },
    );
  }
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
