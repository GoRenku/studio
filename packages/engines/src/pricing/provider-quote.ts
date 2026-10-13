import type { JsonValue, ProviderContext } from '../media/contracts.js';
import { EngineError } from '../shared/errors.js';
import { createRequestTimeoutFetch } from '../shared/request-timeout.js';

/** One quote request; quotes are fast and never cached, so failures fall through to cached prices. */
export async function requestProviderQuote(input: {
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
    throw new EngineError(
      input.context.signal.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_PROVIDER_UNAVAILABLE',
      `The ${input.provider} price quote is unavailable.`,
      { provider: input.provider, model: input.model, cause: error },
    );
  }
  if (!response.ok) {
    throw new EngineError(
      response.status >= 500 || response.status === 429 ? 'ENGINE_PROVIDER_UNAVAILABLE' : 'ENGINE_REQUEST_REJECTED',
      `The ${input.provider} price quote failed with HTTP ${response.status}.`,
      { provider: input.provider, model: input.model, httpStatus: response.status },
    );
  }
  return await response.json() as JsonValue;
}

export function readQuotedAmount(value: string | number | undefined, owner: { provider: string; model: string }): number {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new EngineError('ENGINE_PRICE_INVALID', `The ${owner.provider} quote for ${owner.model} has no amount.`, owner);
  }
  return amount;
}

/** Expiry of an API price: the cached metadata expiry, else the default freshness. */
export function apiPriceExpiry(metadata: { fetchedAt: string; expiresAt?: string }, defaultMaxAgeMs: number): string {
  return metadata.expiresAt ?? new Date(Date.parse(metadata.fetchedAt) + defaultMaxAgeMs).toISOString();
}
