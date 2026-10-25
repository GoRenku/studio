import type { JsonValue, MediaProvider, ProviderContext } from '../media/contracts.js';
import { isEngineError } from '../shared/errors.js';
import { isJsonObject } from '../shared/json-object.js';

/** Stands in for required text such as a prompt when pricing a route before any request exists. */
export const ESTIMATE_TEXT_PLACEHOLDER = 'Price estimate';

/**
 * Fills the request's missing top-level fields with the route input schema's
 * own `default` values, so price tiers and size guesses see what the provider
 * would actually run. With `fillRequiredText`, required string fields that are
 * still missing get a short placeholder, so a provider quote can price a route
 * before a prompt exists; the placeholder is used for pricing only. It knows no
 * model: it only reads JSON Schema `default` and `required`. A provider without
 * a schema, or a schema it cannot read, leaves the request unchanged and says
 * so in a note.
 */
export async function withSchemaDefaults(input: {
  provider: MediaProvider;
  model: string;
  request: JsonValue;
  context: ProviderContext;
  fillRequiredText?: boolean;
}): Promise<{ request: JsonValue; notes: string[] }> {
  const request = input.request;
  if (!input.provider.readInputSchema || !isJsonObject(request)) {
    return { request, notes: [] };
  }
  let schema: JsonValue;
  try {
    schema = await input.provider.readInputSchema(input.model, input.context);
  } catch (error) {
    if (!isEngineError(error) || error.code === 'ENGINE_CANCELLED') {throw error;}
    return { request, notes: [`The route's input schema was unavailable, so its defaults were not applied: ${error.message}`] };
  }
  const properties = isJsonObject(schema) && isJsonObject(schema.properties) ? schema.properties : {};
  const defaults = Object.entries(properties).flatMap(([field, property]) =>
    !(field in request) && isJsonObject(property) && 'default' in property && property.default !== undefined
      ? [[field, property.default as JsonValue] as const]
      : []);
  const required = input.fillRequiredText && isJsonObject(schema) && Array.isArray(schema.required) ? schema.required : [];
  const placeholders = required.flatMap((field) =>
    typeof field === 'string' && !(field in request) && isJsonObject(properties[field]) && properties[field].type === 'string'
      ? [[field, ESTIMATE_TEXT_PLACEHOLDER] as const]
      : []);
  return { request: { ...Object.fromEntries(defaults), ...Object.fromEntries(placeholders), ...request }, notes: [] };
}
