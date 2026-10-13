import type { ProviderContext, ProviderMetadataCacheKey } from '../media/contracts.js';
import type { RoutePrice } from './contracts.js';
import { parseRoutePrice } from './price-schema.js';

/** Recorded entries share the provider metadata cache under their own key space. */
const RECORDED_PRICE_CONTRACT = 'recorded-price-1';

/** Freshness of provider API prices whose responses carry no expiry headers. */
export const API_PRICE_DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Recorded prices expire at most this long after they were observed. */
export const RECORDED_PRICE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function recordedPriceKey(provider: string, model: string): ProviderMetadataCacheKey {
  return { provider, model, url: `renku-recorded-price:${provider}/${model}`, contractVersion: RECORDED_PRICE_CONTRACT };
}

export async function readRecordedPrice(provider: string, model: string, context: ProviderContext): Promise<RoutePrice | null> {
  const entry = await context.metadataCache.read(recordedPriceKey(provider, model));
  return entry ? parseRoutePrice(entry.body, { provider, model }) : null;
}

/**
 * Stores an agent-researched price. Its expiry is the earlier of the agent's
 * expiry (for example a promotion end) and 14 days after it was observed.
 */
export async function recordRoutePrice(input: {
  provider: string;
  model: string;
  price: unknown;
  context: ProviderContext;
}): Promise<RoutePrice> {
  const parsed = parseRoutePrice(input.price, input);
  const observedAt = Date.parse(parsed.source.observedAt);
  const expiresAt = new Date(Math.min(Date.parse(parsed.expiresAt), observedAt + RECORDED_PRICE_MAX_AGE_MS)).toISOString();
  const price: RoutePrice = { ...parsed, source: { ...parsed.source, kind: 'recorded' }, expiresAt };
  await input.context.metadataCache.write(recordedPriceKey(input.provider, input.model), {
    body: price as never,
    contentType: 'application/json',
    fetchedAt: (input.context.clock ?? (() => new Date()))().toISOString(),
    expiresAt,
  });
  return price;
}

export function isFresh(price: RoutePrice, context: ProviderContext): boolean {
  return Date.parse(price.expiresAt) > (context.clock ?? (() => new Date()))().getTime();
}
