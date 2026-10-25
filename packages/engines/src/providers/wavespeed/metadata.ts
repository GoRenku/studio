import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { PROVIDER_CATALOG_MAX_AGE_MS, retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';
import { isJsonObject } from '../../shared/json-object.js';

const MODELS_URL = 'https://api.wavespeed.ai/api/v3/models';

export async function loadWaveSpeedInputSchema(
  model: string,
  context: ProviderContext,
): Promise<JsonValue> {
  const modelMetadata = (await loadWaveSpeedModelRecord(model, context)).record;
  const schemas = isJsonObject(modelMetadata.api_schema)
    ? modelMetadata.api_schema.api_schemas
    : undefined;
  if (!Array.isArray(schemas)) {
    throw invalidMetadata(model);
  }
  const operation = schemas.find(
    (entry) => isJsonObject(entry) && entry.type === 'model_run' && entry.method === 'POST',
  );
  if (!isJsonObject(operation) || !isJsonObject(operation.request_schema)) {
    throw invalidMetadata(model);
  }
  return operation.request_schema;
}

/** One model's record from the cached model list; schema and base price share one read. */
export async function loadWaveSpeedModelRecord(
  model: string,
  context: ProviderContext,
): Promise<{ record: Record<string, JsonValue>; fetchedAt: string; expiresAt?: string }> {
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'wavespeed-ai', model, url: MODELS_URL },
    context,
    headers: { Authorization: `Bearer ${context.credential}` },
    defaultMaxAgeMs: PROVIDER_CATALOG_MAX_AGE_MS,
  });
  if (!isJsonObject(metadata.body) || !Array.isArray(metadata.body.data)) {
    throw invalidMetadata(model);
  }
  const record = metadata.body.data.find(
    (entry) => isJsonObject(entry) && entry.model_id === model,
  );
  if (!isJsonObject(record)) {
    throw new EngineError(
      'ENGINE_METADATA_UNAVAILABLE',
      `WaveSpeed model "${model}" was not found in live provider metadata.`,
      { provider: 'wavespeed-ai', model },
    );
  }
  return { record, fetchedAt: metadata.fetchedAt, expiresAt: metadata.expiresAt };
}

function invalidMetadata(model: string): EngineError {
  return new EngineError(
    'ENGINE_METADATA_INVALID',
    `WaveSpeed metadata for ${model} does not contain a request schema.`,
    { provider: 'wavespeed-ai', model },
  );
}
