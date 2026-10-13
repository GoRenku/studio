import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { replaceLocalMediaFilesWithValidationUrls } from '../../media/local-files.js';
import type { CostQuote, PriceComponent, PriceQuantity, PriceUnit, RoutePrice } from '../../pricing/contracts.js';
import { API_PRICE_DEFAULT_MAX_AGE_MS } from '../../pricing/price-cache.js';
import { apiPriceExpiry, readQuotedAmount, requestProviderQuote } from '../../pricing/provider-quote.js';
import { loadPikaCatalogRecord, PIKA_ORIGIN } from './metadata.js';

/** Pika catalog billing units this vocabulary can express, with the request field that counts them. */
const PIKA_UNITS: Record<string, { unit: PriceUnit; quantity: PriceQuantity; perUnit: number }> = {
  request: { unit: 'request', quantity: { kind: 'constant', value: 1 }, perUnit: 1 },
  second: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 },
  output_second: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 },
  minute: { unit: 'second', quantity: { kind: 'field', pointer: '/duration' }, perUnit: 1 / 60 },
  image: { unit: 'image', quantity: { kind: 'field', pointer: '/num_images', default: 1 }, perUnit: 1 },
  character: { unit: 'character', quantity: { kind: 'characters', pointer: '/text' }, perUnit: 1 },
};

export async function readPikaPrice(model: string, context: ProviderContext): Promise<RoutePrice | null> {
  const metadata = await loadPikaCatalogRecord(model, context);
  const body = metadata.body;
  const pricing = isRecord(body) && isRecord(body.display_pricing) ? body.display_pricing : undefined;
  if (!pricing || !Array.isArray(pricing.components)) {
    return null;
  }
  const notes: string[] = [];
  const components = pricing.components.flatMap((component) => {
    const mapped = mapComponent(component);
    if (!mapped) {notes.push(`Pika bills part of this route per ${describeUnit(component)}, which Renku cannot compute.`);}
    return mapped ? [mapped] : [];
  });
  return {
    currency: 'USD',
    components: notes.length > 0 ? [] : components,
    source: { kind: 'providerApi', url: `${PIKA_ORIGIN}/catalog/apis/${model}`, observedAt: metadata.fetchedAt },
    expiresAt: apiPriceExpiry(metadata, API_PRICE_DEFAULT_MAX_AGE_MS),
    notes,
  };
}

/** The public catalog quote endpoint prices the exact native request without credentials. */
export async function quotePikaCost(model: string, request: JsonValue, context: ProviderContext): Promise<CostQuote> {
  const url = `${PIKA_ORIGIN}/catalog/apis/${model}/quote`;
  const body = await requestProviderQuote({
    provider: 'pika',
    model,
    url,
    body: replaceLocalMediaFilesWithValidationUrls(request),
    context,
  });
  const amount = isRecord(body) && (typeof body.sell_usd === 'string' || typeof body.sell_usd === 'number') ? body.sell_usd : undefined;
  return { amountUsd: readQuotedAmount(amount, { provider: 'pika', model }), sourceUrl: url };
}

function mapComponent(value: JsonValue): PriceComponent | undefined {
  if (!isRecord(value) || !isRecord(value.unit) || typeof value.unit.type !== 'string') {return undefined;}
  const unit = PIKA_UNITS[value.unit.type];
  const base = isRecord(value.starting_at) ? microUsd(value.starting_at.micro_usd) : undefined;
  if (!unit || base === undefined) {return undefined;}
  const tiers = Array.isArray(value.price_tiers) ? value.price_tiers.flatMap((tier) => {
    const price = isRecord(tier) ? microUsd(tier.micro_usd) : undefined;
    if (!isRecord(tier) || !isRecord(tier.spec) || price === undefined) {return [];}
    const when = Object.fromEntries(Object.entries(tier.spec).map(([field, expected]) => [`/${field}`, expected]));
    return [{ when, unitPriceUsd: price * unit.perUnit }];
  }) : [];
  return {
    unit: unit.unit,
    unitPriceUsd: base * unit.perUnit,
    quantity: unit.quantity,
    ...(tiers.length > 0 ? { tiers } : {}),
  };
}

function describeUnit(value: JsonValue): string {
  return isRecord(value) && isRecord(value.unit) && typeof value.unit.type === 'string' ? value.unit.type.replace(/_/g, ' ') : 'an unknown unit';
}

function microUsd(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value / 1_000_000 : undefined;
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
