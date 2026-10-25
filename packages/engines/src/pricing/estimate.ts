import type { JsonValue, MediaProvider, ProviderContext } from '../media/contracts.js';
import type { CostEstimate, PriceComponent, RoutePrice } from './contracts.js';
import { evaluateRoutePrice } from './price-evaluation.js';
import { readRoutePrice } from './price-cache.js';
import { readSavedQuote } from './quote-cache.js';
import { withSchemaDefaults } from './request-defaults.js';

/** Saved prices and schemas are reused this long while estimating; prices change rarely. */
export const ESTIMATE_METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The longest an estimate waits for one refresh of old provider metadata. */
export const ESTIMATE_REFRESH_TIMEOUT_MS = 5_000;

/**
 * Estimates one native request, or one output of a route at its defaults.
 * A provider that quotes exact settings is asked through its saved quote,
 * reused like a price; otherwise, or when the quote fails, the saved price of
 * the route is evaluated after filling the route's schema defaults. Old
 * metadata and quotes get one quick refresh that falls back to the saved copy.
 * A missing price is never zero.
 */
export async function estimateRouteCost(input: {
  provider: MediaProvider;
  model: string;
  /** Omitted to price one output of the route at its defaults. */
  request?: JsonValue;
  /** With no request: native fields set over the route's defaults, such as an output size. */
  fields?: Record<string, JsonValue>;
  context: ProviderContext;
}): Promise<CostEstimate> {
  const context: ProviderContext = {
    ...input.context,
    requestTimeoutMs: Math.min(input.context.requestTimeoutMs, ESTIMATE_REFRESH_TIMEOUT_MS),
    cachedMetadataReuse: { maxAgeMs: ESTIMATE_METADATA_MAX_AGE_MS, failedRefreshes: new Set() },
  };
  const atDefaults = input.request === undefined;
  const prepared = await withSchemaDefaults({ ...input, request: input.request ?? { ...input.fields }, context, fillRequiredText: atDefaults });
  const quoted = input.provider.quoteCost
    ? await readSavedQuote({ provider: input.provider, model: input.model, request: prepared.request, context })
    : null;
  if (quoted?.quote) {
    return {
      state: 'computed',
      amountUsd: quoted.quote.amountUsd,
      basis: quoteBasis(input),
      observedAt: quoted.observedAt,
      sourceUrl: quoted.quote.sourceUrl,
      notes: prepared.notes,
    };
  }
  const price = await readRoutePrice({ provider: input.provider, model: input.model, context });
  const request = price && atDefaults ? withOneOutput(price, prepared.request) : prepared.request;
  const estimate: CostEstimate = price
    ? fromPrice(price, request, [...prepared.notes, ...price.notes])
    : { state: 'missingPrice', basis: 'No price is known for this route', notes: prepared.notes };
  return estimate.state === 'computed' || !quoted ? estimate : { ...estimate, notes: [...estimate.notes, quoted.note] };
}

function quoteBasis(input: { request?: JsonValue; fields?: Record<string, JsonValue> }): string {
  if (input.request !== undefined) {return 'Provider quote for these settings';}
  return input.fields && Object.keys(input.fields).length > 0
    ? 'Provider quote for one output at the given settings'
    : 'Provider quote for one output at default settings';
}

/** Sets every top-level image count field the price reads to one. */
function withOneOutput(price: RoutePrice, request: JsonValue): JsonValue {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return request;
  }
  const fields = price.components.flatMap((component) => {
    const field = /^\/([^/~]+)$/.exec(imageCountPointer(component) ?? '')?.[1];
    return field ? [[field, 1] as const] : [];
  });
  return { ...request, ...Object.fromEntries(fields) };
}

function imageCountPointer(component: PriceComponent): string | undefined {
  if (component.quantity.kind === 'imageMegapixels') {
    return component.quantity.countPointer;
  }
  return component.unit === 'image' && component.quantity.kind === 'field' ? component.quantity.pointer : undefined;
}

function fromPrice(price: RoutePrice, request: JsonValue, notes: string[]): CostEstimate {
  const evaluation = evaluateRoutePrice(price, request);
  const source = { observedAt: price.source.observedAt, ...(price.source.url ? { sourceUrl: price.source.url } : {}) };
  if (evaluation.kind === 'unpriced') {
    return { state: 'unpriced', basis: evaluation.note, ...source, notes: notes.filter((note) => note !== evaluation.note) };
  }
  return { state: 'computed', amountUsd: evaluation.amountUsd, basis: evaluation.basis, ...source, notes };
}
