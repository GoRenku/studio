import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { replaceLocalMediaFilesWithValidationUrls } from '../../media/local-files.js';
import type { CostQuote, RoutePrice } from '../../pricing/contracts.js';
import { postProviderQuote, readQuotedAmount } from '../../pricing/provider-quote.js';
import { isJsonObject } from '../../shared/json-object.js';
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
    notes: ['WaveSpeed base price per run; duration and resolution can change the charge.'],
  };
}

/** The pricing endpoint quotes one exact native request, so duration and resolution count. */
export async function quoteWaveSpeedCost(model: string, request: JsonValue, context: ProviderContext): Promise<CostQuote> {
  const body = await postProviderQuote({
    provider: 'wavespeed-ai',
    model,
    url: PRICING_URL,
    headers: { Authorization: `Bearer ${context.credential}` },
    body: { model_id: model, inputs: replaceLocalMediaFilesWithValidationUrls(request) },
    context,
  });
  const data = isJsonObject(body) && isJsonObject(body.data) ? body.data : undefined;
  return { amountUsd: readQuotedAmount(data?.unit_price, { provider: 'wavespeed-ai', model }), sourceUrl: PRICING_URL };
}
