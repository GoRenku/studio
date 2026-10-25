import type { ProviderContext } from '../../media/contracts.js';
import { BILLING_UNITS, type BillingUnitKey } from '../../pricing/billing-units.js';
import type { RoutePrice } from '../../pricing/contracts.js';
import { isJsonObject } from '../../shared/json-object.js';
import { PROVIDER_CATALOG_MAX_AGE_MS, retrieveProviderMetadata } from '../../shared/metadata-retrieval.js';

const PRICING_URL = 'https://api.fal.ai/v1/models/pricing';
const ESTIMATE_URL = 'https://api.fal.ai/v1/models/pricing/estimate';

/** Fal.ai billing unit names this vocabulary can express. */
const FAL_UNITS: Record<string, BillingUnitKey> = {
  image: 'image',
  images: 'image',
  video: 'request',
  videos: 'request',
  request: 'request',
  requests: 'request',
  generation: 'request',
  megapixel: 'megapixel',
  megapixels: 'megapixel',
  second: 'second',
  seconds: 'second',
  minute: 'minute',
  minutes: 'minute',
  characters: 'character',
  '1k characters': 'thousandCharacters',
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
    defaultMaxAgeMs: PROVIDER_CATALOG_MAX_AGE_MS,
  });
  const body = metadata.body;
  const entry = isJsonObject(body) && Array.isArray(body.prices)
    ? body.prices.find((price) => isJsonObject(price) && price.endpoint_id === model)
    : undefined;
  if (!isJsonObject(entry) || typeof entry.unit !== 'string' || typeof entry.unit_price !== 'number' || entry.currency !== 'USD') {
    return null;
  }
  const source = { kind: 'providerApi' as const, url: `https://fal.ai/models/${model}`, observedAt: metadata.fetchedAt };
  const key = FAL_UNITS[entry.unit.trim().toLowerCase()];
  if (!key) {
    return readFalTypicalCallPrice(model, entry.unit, context);
  }
  const unit = BILLING_UNITS[key];
  return {
    currency: 'USD',
    components: [{ unit: unit.unit, unitPriceUsd: entry.unit_price * unit.perUnit, quantity: unit.quantity }],
    source,
    notes: ['Fal.ai base price; resolution, audio or account discounts can change the charge.'],
  };
}

/**
 * For a unit Renku cannot count from the request, such as tokens, Fal.ai's
 * estimate service gives the typical charge of one call from past usage. It
 * ignores the request's settings, and the note says so.
 */
async function readFalTypicalCallPrice(model: string, unit: string, context: ProviderContext): Promise<RoutePrice> {
  const metadata = await retrieveProviderMetadata({
    key: { provider: 'fal-ai', model, url: ESTIMATE_URL, contractVersion: 'historical-call-price-1' },
    context,
    headers: { Authorization: `Key ${context.credential}` },
    body: { estimate_type: 'historical_api_price', endpoints: { [model]: { call_quantity: 1 } } },
    defaultMaxAgeMs: PROVIDER_CATALOG_MAX_AGE_MS,
  });
  const body = metadata.body;
  const source = { kind: 'providerApi' as const, url: `https://fal.ai/models/${model}`, observedAt: metadata.fetchedAt };
  const cost = isJsonObject(body) && body.currency === 'USD' && typeof body.total_cost === 'number' && body.total_cost > 0 ? body.total_cost : undefined;
  if (cost === undefined) {
    return { currency: 'USD', components: [], source, notes: [`Fal.ai bills this route per ${unit}, which Renku cannot compute.`] };
  }
  return {
    currency: 'USD',
    components: [{ unit: 'request', unitPriceUsd: cost, quantity: { kind: 'constant', value: 1 } }],
    source,
    notes: [`Typical Fal.ai charge per call from past usage; Fal.ai bills this route per ${unit}, so duration, resolution or length can change the charge.`],
  };
}
