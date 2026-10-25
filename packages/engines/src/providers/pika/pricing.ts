import type { JsonValue, ProviderContext } from '../../media/contracts.js';
import { replaceLocalMediaFilesWithValidationUrls } from '../../media/local-files.js';
import { BILLING_UNITS, type BillingUnitKey } from '../../pricing/billing-units.js';
import type { CostQuote, PriceComponent, RoutePrice } from '../../pricing/contracts.js';
import { postProviderQuote, readQuotedAmount } from '../../pricing/provider-quote.js';
import { isJsonObject } from '../../shared/json-object.js';
import { loadPikaCatalogRecord, PIKA_ORIGIN } from './metadata.js';

/** Pika catalog billing unit names this vocabulary can express. */
const PIKA_UNITS: Record<string, BillingUnitKey> = {
  request: 'request',
  second: 'second',
  output_second: 'second',
  minute: 'minute',
  image: 'image',
  character: 'character',
};

export async function readPikaPrice(model: string, context: ProviderContext): Promise<RoutePrice | null> {
  const metadata = await loadPikaCatalogRecord(model, context);
  const body = metadata.body;
  const pricing = isJsonObject(body) && isJsonObject(body.display_pricing) ? body.display_pricing : undefined;
  if (!pricing || !Array.isArray(pricing.components)) {
    return null;
  }
  const mapped = pricing.components.map((component) => ({ component, price: mapComponent(component) }));
  const unexpressed = mapped.filter((entry) => !entry.price).map((entry) => describeUnit(entry.component));
  return {
    currency: 'USD',
    components: unexpressed.length > 0 ? [] : mapped.flatMap((entry) => entry.price ? [entry.price] : []),
    source: { kind: 'providerApi', url: `${PIKA_ORIGIN}/catalog/apis/${model}`, observedAt: metadata.fetchedAt },
    notes: unexpressed.length > 0 ? [`Pika bills this route per ${joinUnits(unexpressed)}, which Renku cannot compute from the request.`] : [],
  };
}

/** The public catalog quote prices one exact native request without credentials. */
export async function quotePikaCost(model: string, request: JsonValue, context: ProviderContext): Promise<CostQuote> {
  const body = await postProviderQuote({
    provider: 'pika',
    model,
    url: `${PIKA_ORIGIN}/catalog/apis/${model}/quote`,
    body: replaceLocalMediaFilesWithValidationUrls(request),
    context,
  });
  const amount = readQuotedAmount(isJsonObject(body) ? body.sell_usd : undefined, { provider: 'pika', model });
  return { amountUsd: amount, sourceUrl: `${PIKA_ORIGIN}/catalog/apis/${model}` };
}

function mapComponent(value: JsonValue): PriceComponent | undefined {
  if (!isJsonObject(value) || !isJsonObject(value.unit) || typeof value.unit.type !== 'string') {return undefined;}
  const key = PIKA_UNITS[value.unit.type];
  const unit = key ? BILLING_UNITS[key] : undefined;
  // Pika prices a block of units, such as one image or one million tokens.
  const block = typeof value.unit.quantity === 'number' && value.unit.quantity > 0 ? value.unit.quantity : 1;
  const base = isJsonObject(value.starting_at) ? microUsd(value.starting_at.micro_usd) : undefined;
  if (!unit || base === undefined) {return undefined;}
  const tiers = Array.isArray(value.price_tiers) ? value.price_tiers.flatMap((tier) => {
    const price = isJsonObject(tier) ? microUsd(tier.micro_usd) : undefined;
    if (!isJsonObject(tier) || !isJsonObject(tier.spec) || price === undefined) {return [];}
    const when = Object.fromEntries(Object.entries(tier.spec).map(([field, expected]) => [`/${field}`, expected]));
    return [{ when, unitPriceUsd: (price * unit.perUnit) / block }];
  }) : [];
  return {
    unit: unit.unit,
    unitPriceUsd: (base * unit.perUnit) / block,
    quantity: unit.quantity,
    ...(tiers.length > 0 ? { tiers } : {}),
  };
}

function describeUnit(value: JsonValue): string {
  return isJsonObject(value) && isJsonObject(value.unit) && typeof value.unit.type === 'string' ? value.unit.type.replace(/_/g, ' ') : 'an unknown unit';
}

function joinUnits(units: string[]): string {
  const unique = [...new Set(units)];
  return unique.length === 1 ? unique[0]! : `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`;
}

function microUsd(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value / 1_000_000 : undefined;
}
