import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';

const MODELS_URL = 'https://api.wavespeed.ai/api/v3/models';

export async function loadWaveSpeedInputSchema(
  model: string,
  context: ProviderContext,
): Promise<JsonValue> {
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'wavespeed-ai', model, url: MODELS_URL },
    context,
    headers: { Authorization: `Bearer ${context.credential}` },
  });
  if (!isRecord(metadata.body) || !Array.isArray(metadata.body.data)) {
    throw invalidMetadata(model);
  }
  const modelMetadata = metadata.body.data.find(
    (entry) => isRecord(entry) && entry.model_id === model,
  );
  if (!isRecord(modelMetadata)) {
    throw new EngineError(
      'ENGINE_METADATA_UNAVAILABLE',
      `WaveSpeed model "${model}" was not found in live provider metadata.`,
      { provider: 'wavespeed-ai', model },
    );
  }
  const schemas = isRecord(modelMetadata.api_schema)
    ? modelMetadata.api_schema.api_schemas
    : undefined;
  if (!Array.isArray(schemas)) {
    throw invalidMetadata(model);
  }
  const operation = schemas.find(
    (entry) => isRecord(entry) && entry.type === 'model_run' && entry.method === 'POST',
  );
  if (!isRecord(operation) || !isRecord(operation.request_schema)) {
    throw invalidMetadata(model);
  }
  return operation.request_schema;
}

function invalidMetadata(model: string): EngineError {
  return new EngineError(
    'ENGINE_METADATA_INVALID',
    `WaveSpeed metadata for ${model} does not contain a request schema.`,
    { provider: 'wavespeed-ai', model },
  );
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
