import type { JsonValue, MediaProvider, ProviderContext } from '../media/contracts.js';
import { isEngineError } from '../shared/errors.js';

/**
 * Fills the request's missing top-level fields with the route input schema's
 * own `default` values, so price tiers and size guesses see what the provider
 * would actually run. It knows no model: it only reads JSON Schema defaults.
 * A provider without a schema, or a schema it cannot read, leaves the request
 * unchanged and says so in a note.
 */
export async function withSchemaDefaults(input: {
  provider: MediaProvider;
  model: string;
  request: JsonValue;
  context: ProviderContext;
}): Promise<{ request: JsonValue; notes: string[] }> {
  const request = input.request;
  if (!input.provider.readInputSchema || !isRecord(request)) {
    return { request, notes: [] };
  }
  let schema: JsonValue;
  try {
    schema = await input.provider.readInputSchema(input.model, input.context);
  } catch (error) {
    if (!isEngineError(error) || error.code === 'ENGINE_CANCELLED') {throw error;}
    return { request, notes: [`The route's input schema was unavailable, so its defaults were not applied: ${error.message}`] };
  }
  const properties = isRecord(schema) && isRecord(schema.properties) ? schema.properties : {};
  const defaults = Object.entries(properties).flatMap(([field, property]) =>
    !(field in request) && isRecord(property) && 'default' in property && property.default !== undefined
      ? [[field, property.default as JsonValue] as const]
      : []);
  return { request: { ...Object.fromEntries(defaults), ...request }, notes: [] };
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
