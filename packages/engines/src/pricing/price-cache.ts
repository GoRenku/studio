import type { MediaProvider, ProviderContext, ProviderMetadataCacheKey } from '../media/contracts.js';
import type { RoutePrice } from './contracts.js';
import { parseRoutePrice } from './price-schema.js';

/** Recorded entries share the provider metadata cache under their own key space. */
const RECORDED_PRICE_CONTRACT = 'recorded-price-1';

function recordedPriceKey(provider: string, model: string): ProviderMetadataCacheKey {
  return { provider, model, url: `renku-recorded-price:${provider}/${model}`, contractVersion: RECORDED_PRICE_CONTRACT };
}

/**
 * The saved price an estimate uses for one route: the agent-researched entry
 * when there is one, otherwise the provider's API price, or null.
 */
export async function readRoutePrice(input: {
  provider: MediaProvider;
  model: string;
  context: ProviderContext;
}): Promise<RoutePrice | null> {
  const entry = await input.context.metadataCache.read(recordedPriceKey(input.provider.id, input.model));
  if (entry) {
    return parseRoutePrice(entry.body, { provider: input.provider.id, model: input.model });
  }
  return input.provider.readPrice ? input.provider.readPrice(input.model, input.context) : null;
}

/** Stores an agent-researched price. It never expires; recording again replaces it. */
export async function recordRoutePrice(input: {
  provider: string;
  model: string;
  price: unknown;
  context: ProviderContext;
}): Promise<RoutePrice> {
  const parsed = parseRoutePrice(input.price, input);
  const price: RoutePrice = { ...parsed, source: { ...parsed.source, kind: 'recorded' } };
  await input.context.metadataCache.write(recordedPriceKey(input.provider, input.model), {
    body: price as never,
    contentType: 'application/json',
    fetchedAt: (input.context.clock ?? (() => new Date()))().toISOString(),
  });
  return price;
}
