import type { JsonValue, ProviderContext } from '../media/contracts.js';
import { EngineError } from '../shared/errors.js';
import { isJsonObject } from '../shared/json-object.js';
import { createRequestTimeoutFetch } from '../shared/request-timeout.js';

/**
 * Posts one quote request and returns the provider's JSON answer. A transport
 * failure or a rejected request is a structured error that names the
 * provider's own reason when it gives one.
 */
export async function postProviderQuote(input: {
  provider: string;
  model: string;
  url: string;
  headers?: Record<string, string>;
  body: JsonValue;
  context: ProviderContext;
}): Promise<JsonValue> {
  let response: Response;
  try {
    response = await createRequestTimeoutFetch({ provider: input.provider, model: input.model, context: input.context })(input.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...input.headers },
      body: JSON.stringify(input.body),
      signal: input.context.signal,
    });
  } catch (error) {
    if (error instanceof EngineError) {throw error;}
    throw new EngineError('ENGINE_PROVIDER_UNAVAILABLE', 'The price quote is unavailable.', { provider: input.provider, model: input.model, cause: error });
  }
  const body = await response.json().catch(() => null) as JsonValue;
  if (!response.ok) {
    const reason = isJsonObject(body) && typeof body.message === 'string' ? body.message : `HTTP ${response.status}`;
    throw new EngineError('ENGINE_PRICE_INVALID', `The provider could not quote this request: ${reason}.`, { provider: input.provider, model: input.model, httpStatus: response.status });
  }
  return body;
}

/** A quoted amount in US dollars, or a structured error when the answer has none. */
export function readQuotedAmount(value: JsonValue | undefined, owner: { provider: string; model: string }): number {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new EngineError('ENGINE_PRICE_INVALID', 'The provider quote has no amount.', owner);
  }
  return amount;
}
