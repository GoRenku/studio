import type { JsonValue, MediaProvider, ProviderContext } from '../media/contracts.js';
import { isEngineError } from '../shared/errors.js';
import type { CostEstimate, RoutePrice } from './contracts.js';
import { evaluateRoutePrice } from './price-evaluation.js';
import { isFresh, readRecordedPrice } from './price-cache.js';
import { withSchemaDefaults } from './request-defaults.js';

/**
 * Estimates one native request: a live provider quote, then a fresh recorded
 * entry, then the provider's API price. A missing price is never zero.
 */
export async function estimateRouteCost(input: {
  provider: MediaProvider;
  model: string;
  request: JsonValue;
  context: ProviderContext;
}): Promise<CostEstimate> {
  const prepared = await withSchemaDefaults(input);
  const request = prepared.request;
  const notes: string[] = [...prepared.notes];
  const now = (input.context.clock ?? (() => new Date()))().toISOString();
  if (input.provider.quoteCost) {
    try {
      const quote = await input.provider.quoteCost(input.model, request, input.context);
      return { state: 'quoted', amountUsd: quote.amountUsd, basis: 'Provider quote for this request', observedAt: now, sourceUrl: quote.sourceUrl, notes };
    } catch (error) {
      if (!isEngineError(error) || error.code === 'ENGINE_CANCELLED') {throw error;}
      notes.push(`The provider quote was unavailable: ${error.message}`);
    }
  }
  const recorded = await readRecordedPrice(input.provider.id, input.model, input.context);
  if (recorded && isFresh(recorded, input.context)) {
    return fromPrice(recorded, request, [...notes, ...recorded.notes]);
  }
  const apiPrice = input.provider.readPrice ? await input.provider.readPrice(input.model, input.context) : null;
  if (apiPrice) {
    return fromPrice(apiPrice, request, [...notes, ...apiPrice.notes]);
  }
  if (recorded) {
    return { state: 'expired', basis: 'The recorded price has expired', observedAt: recorded.source.observedAt, sourceUrl: recorded.source.url, notes };
  }
  return { state: 'missingPrice', basis: 'No price is known for this route', notes };
}

function fromPrice(price: RoutePrice, request: JsonValue, notes: string[]): CostEstimate {
  const evaluation = evaluateRoutePrice(price, request);
  const source = { observedAt: price.source.observedAt, ...(price.source.url ? { sourceUrl: price.source.url } : {}) };
  if (evaluation.kind === 'unpriced') {
    return { state: 'unpriced', basis: evaluation.note, ...source, notes: notes.filter((note) => note !== evaluation.note) };
  }
  return { state: 'computed', amountUsd: evaluation.amountUsd, basis: evaluation.basis, ...source, notes };
}
