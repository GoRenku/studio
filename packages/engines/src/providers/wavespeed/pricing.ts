import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { replaceLocalMediaFilesWithValidationUrls } from '../../media/local-files.js';
import type { CostQuote, RoutePrice } from '../../pricing/contracts.js';
import { API_PRICE_DEFAULT_MAX_AGE_MS } from '../../pricing/price-cache.js';
import { apiPriceExpiry, readQuotedAmount, requestProviderQuote } from '../../pricing/provider-quote.js';
import { loadWaveSpeedModelRecord } from './metadata.js';

const PRICING_URL = 'https://api.wavespeed.ai/api/v3/model/pricing';

/** The cached model list carries a per-run base price; duration or resolution can change the real charge. */
export async function readWaveSpeedPrice(model: string, context: ProviderContext): Promise<RoutePrice | null> {
  const metadata = await loadWaveSpeedModelRecord(model, context);
  const basePrice = metadata.record.base_price;
  if (typeof basePrice !== 'number' || !Number.isFinite(basePrice) || basePrice < 0) {
    return null;
  }
  return {
    currency: 'USD',
    components: [{ unit: 'request', unitPriceUsd: basePrice, quantity: { kind: 'constant', value: 1 } }],
    source: { kind: 'providerApi', url: 'https://api.wavespeed.ai/api/v3/models', observedAt: metadata.fetchedAt },
    expiresAt: apiPriceExpiry(metadata, API_PRICE_DEFAULT_MAX_AGE_MS),
    notes: ['WaveSpeed base price per run; duration and resolution can change the charge.'],
  };
}

export async function quoteWaveSpeedCost(model: string, request: JsonValue, context: ProviderContext): Promise<CostQuote> {
  const body = await requestProviderQuote({
    provider: 'wavespeed-ai',
    model,
    url: PRICING_URL,
    headers: { Authorization: `Bearer ${context.credential}` },
    body: { model_id: model, inputs: replaceLocalMediaFilesWithValidationUrls(request) },
    context,
  });
  const data = isRecord(body) && isRecord(body.data) ? body.data : undefined;
  const amount = typeof data?.unit_price === 'number' || typeof data?.unit_price === 'string' ? data.unit_price : undefined;
  return { amountUsd: readQuotedAmount(amount, { provider: 'wavespeed-ai', model }), sourceUrl: PRICING_URL };
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
