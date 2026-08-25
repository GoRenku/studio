import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';
import { EngineError } from '../../shared/errors.js';

export async function loadReplicateInputSchema(
  model: string,
  context: ProviderContext,
): Promise<JsonValue> {
  const parsed = parseReplicateModel(model);
  const url = parsed.version
    ? `https://api.replicate.com/v1/models/${parsed.owner}/${parsed.name}/versions/${parsed.version}`
    : `https://api.replicate.com/v1/models/${parsed.owner}/${parsed.name}`;
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'replicate', model, url, contractVersion: parsed.version },
    context,
    headers: { Authorization: `Bearer ${context.credential}` },
  });
  const version = parsed.version
    ? metadata.body
    : isRecord(metadata.body) ? metadata.body.latest_version : undefined;
  const schema = readPath(version, ['openapi_schema', 'components', 'schemas', 'Input']);
  const components = readPath(version, ['openapi_schema', 'components']);
  if (!isRecord(schema) || !isRecord(components)) {
    throw new EngineError(
      'ENGINE_METADATA_INVALID',
      `Replicate metadata for ${model} does not contain an input schema.`,
      { provider: 'replicate', model },
    );
  }
  return { ...schema, components };
}

export function parseReplicateModel(model: string): {
  owner: string;
  name: string;
  version?: string;
} {
  const [identifier, version] = model.split(':', 2);
  const [owner, name, ...extra] = identifier.split('/');
  if (!owner || !name || extra.length > 0) {
    throw new EngineError(
      'ENGINE_REQUEST_INVALID',
      'Replicate model must use owner/model or owner/model:version.',
      { provider: 'replicate', model },
    );
  }
  return { owner, name, ...(version ? { version } : {}) };
}

function readPath(value: JsonValue | undefined, path: string[]): JsonValue | undefined {
  let current = value;
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
