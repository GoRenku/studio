import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import type { PriceQuantity, PriceUnit, RoutePrice } from '../../pricing/contracts.js';
import { API_PRICE_DEFAULT_MAX_AGE_MS } from '../../pricing/price-cache.js';
import { apiPriceExpiry } from '../../pricing/provider-quote.js';
import { retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';

const PRICING_URL = 'https://api.fal.ai/v1/models/pricing';

/** Fal.ai billing units this vocabulary can express, with the request field that counts them. */
const FAL_UNITS: Record<string, { unit: PriceUnit; quantity: PriceQuantity; perUnit: number }> = {
  image: { unit: 'image', quantity: { kind: 'field', pointer: '/num_images', default: 1 }, perUnit: 1 },
  images: { unit: 'image', quantity: { kind: 'field', pointer: '/num_images', default: 1 }, perUnit: 1 },
  video: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  videos: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  request: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  requests: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  generation: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  megapixel: { unit: 'megapixel', quantity: { kind: 'imageMegapixels', countPointer: '/num_images' }, perUnit: 1 },
  megapixels: { unit: 'megapixel', quantity: { kind: 'imageMegapixels', countPointer: '/num_images' }, perUnit: 1 },
  second: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 },
  seconds: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 },
  minute: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 / 60 },
  minutes: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 / 60 },
  characters: { unit: 'character', quantity: { kind: 'characters', pointer: '/text' }, perUnit: 1 },
  '1k characters': { unit: 'character', quantity: { kind: 'characters', pointer: '/text' }, perUnit: 1 / 1000 },
};

/**
 * The pricing API gives one unit price per endpoint. Resolution and audio
 * adjustments are not in the API, so the estimate notes that it is a base price.
 */
export async function readFalPrice(model: string, context: ProviderContext): Promise<RoutePrice | null> {
  const url = new URL(PRICING_URL);
  url.searchParams.set('endpoint_id', model);
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'fal-ai', model, url: url.toString() },
    context,
    headers: { Authorization: `Key ${context.credential}` },
    defaultMaxAgeMs: API_PRICE_DEFAULT_MAX_AGE_MS,
  });
  const body = metadata.body;
  const entry = isRecord(body) && Array.isArray(body.prices)
    ? body.prices.find((price) => isRecord(price) && price.endpoint_id === model)
    : undefined;
  if (!isRecord(entry) || typeof entry.unit !== 'string' || typeof entry.unit_price !== 'number' || entry.currency !== 'USD') {
    return null;
  }
  const source = { kind: 'providerApi' as const, url: `https://fal.ai/models/${model}`, observedAt: metadata.fetchedAt };
  const expiresAt = apiPriceExpiry(metadata, API_PRICE_DEFAULT_MAX_AGE_MS);
  const unit = FAL_UNITS[entry.unit.trim().toLowerCase()];
  if (!unit) {
    return { currency: 'USD', components: [], source, expiresAt, notes: [`Fal.ai bills this route per ${entry.unit}, which Renku cannot compute.`] };
  }
  return {
    currency: 'USD',
    components: [{ unit: unit.unit, unitPriceUsd: entry.unit_price * unit.perUnit, quantity: unit.quantity }],
    source,
    expiresAt,
    notes: ['Fal.ai base price; resolution, audio or account discounts can change the charge.'],
  };
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
