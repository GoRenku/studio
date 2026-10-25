import { createHash } from 'node:crypto';
import type { JsonValue, MediaProvider, ProviderContext, ProviderMetadataCacheKey } from '../media/contracts.js';
import { isEngineError } from '../shared/errors.js';
import { isJsonObject } from '../shared/json-object.js';
import type { CostQuote } from './contracts.js';

/** Saved quotes share the provider metadata cache under their own key space. */
const SAVED_QUOTE_CONTRACT = 'saved-quote-1';

function savedQuoteKey(provider: string, model: string, request: JsonValue): ProviderMetadataCacheKey {
  const requestSha256 = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return { provider, model, url: `renku-saved-quote:${provider}/${model}/${requestSha256}`, contractVersion: SAVED_QUOTE_CONTRACT };
}

/**
 * The provider's quote for one request, saved like a price: a saved quote
 * younger than the estimate's reuse age is used as is; otherwise the provider
 * is asked once, and a failed request keeps the saved copy. Null when the
 * provider gives no quote and none is saved.
 */
export async function readSavedQuote(input: {
  provider: MediaProvider;
  model: string;
  request: JsonValue;
  context: ProviderContext;
}): Promise<{ quote: CostQuote; observedAt: string } | { quote: null; note: string }> {
  const key = savedQuoteKey(input.provider.id, input.model, input.request);
  const saved = await input.context.metadataCache.read(key);
  const savedQuote = saved && isCostQuote(saved.body) ? { quote: saved.body, observedAt: saved.fetchedAt } : null;
  const now = (input.context.clock ?? (() => new Date()))();
  const maxAgeMs = input.context.cachedMetadataReuse?.maxAgeMs ?? 0;
  if (savedQuote && now.getTime() - Date.parse(savedQuote.observedAt) < maxAgeMs) {
    return savedQuote;
  }
  try {
    const quote = await input.provider.quoteCost!(input.model, input.request, input.context);
    await input.context.metadataCache.write(key, { body: { ...quote }, contentType: 'application/json', fetchedAt: now.toISOString() });
    return { quote, observedAt: now.toISOString() };
  } catch (error) {
    if (!isEngineError(error) || error.code === 'ENGINE_CANCELLED') {throw error;}
    return savedQuote ?? { quote: null, note: `The provider quote was unavailable: ${error.message}` };
  }
}

function isCostQuote(value: JsonValue | string): value is JsonValue & CostQuote {
  return isJsonObject(value) && typeof value.amountUsd === 'number' && typeof value.sourceUrl === 'string';
}
