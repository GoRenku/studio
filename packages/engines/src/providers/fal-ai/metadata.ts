import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';
import { isJsonObject } from '../../shared/json-object.js';

const MODELS_URL = 'https://api.fal.ai/v1/models';

export async function loadFalInputSchema(
  model: string,
  context: ProviderContext,
): Promise<JsonValue> {
  assertExactFalEndpointId(model);
  const url = new URL(MODELS_URL);
  url.searchParams.set('endpoint_id', model);
  url.searchParams.set('expand', 'openapi-3.0');
  // The model catalog is public. Sending the account key adds nothing the
  // schema lookup needs, and Fal can fail the OpenAPI expansion for an
  // authenticated account while the same public request succeeds.
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'fal-ai', model, url: url.toString() },
    context,
  });
  const body = metadata.body;
  if (!isJsonObject(body) || !Array.isArray(body.models)) {
    throw invalidMetadata(model);
  }
  const selected = body.models.find(
    (entry) => isJsonObject(entry) && entry.endpoint_id === model,
  );
  if (!isJsonObject(selected)) {
    throw new EngineError(
      'ENGINE_METADATA_UNAVAILABLE',
      `Fal.ai endpoint "${model}" was not found in live provider metadata.`,
      { provider: 'fal-ai', model },
    );
  }
  const openApi = selected.openapi;
  if (isJsonObject(openApi) && isJsonObject(openApi.error)) {
    throw expansionFailed(model, openApi.error);
  }
  if (!isJsonObject(openApi) || !isJsonObject(openApi.paths) || !isJsonObject(openApi.components)) {
    throw invalidMetadata(model);
  }
  const inputSchemas = Object.values(openApi.paths).flatMap((operation) => {
    if (!isJsonObject(operation) || !isJsonObject(operation.post)) {
      return [];
    }
    const schema = readPath(
      operation.post,
      ['requestBody', 'content', 'application/json', 'schema'],
    );
    return isJsonObject(schema) ? [schema] : [];
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

function expansionFailed(model: string, error: Record<string, JsonValue>): EngineError {
  const code = typeof error.code === 'string' ? error.code : 'unknown';
  const message = typeof error.message === 'string' ? error.message : 'No reason given.';
  return new EngineError(
    'ENGINE_METADATA_UNAVAILABLE',
    `Fal.ai could not provide the input schema for ${model}: ${message} (${code}).`,
    { provider: 'fal-ai', model, details: { providerError: { code, message } } },
  );
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
    if (!isJsonObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}
