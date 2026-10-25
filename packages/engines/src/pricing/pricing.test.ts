import { describe, expect, it, vi } from 'vitest';
import type { MediaProvider, ProviderContext } from '../media/contracts.js';
import { createMediaEngine } from '../media/engine.js';
import { EngineError } from '../shared/errors.js';
import { createMemoryProviderMetadataCache } from '../shared/metadata-cache.js';
import type { RoutePrice } from './contracts.js';
import { evaluateRoutePrice } from './price-evaluation.js';
import { parseRoutePrice } from './price-schema.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');

function context(overrides: Partial<ProviderContext> = {}): ProviderContext {
  return {
    credential: 'test-key',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: vi.fn(),
    clock: () => NOW,
    signal: new AbortController().signal,
    requestTimeoutMs: 1000,
    operationTimeoutMs: 1000,
    ...overrides,
  };
}

function price(components: RoutePrice['components'], overrides: Partial<RoutePrice> = {}): RoutePrice {
  return {
    currency: 'USD',
    components,
    source: { kind: 'recorded', url: 'https://example.test/pricing', observedAt: '2026-10-10T00:00:00.000Z' },
    notes: [],
    ...overrides,
  };
}

// Fictional provider: pricing only depends on the provider capabilities it implements.
function provider(capabilities: Partial<MediaProvider> = {}): MediaProvider {
  return {
    id: 'acme',
    validate: async () => undefined,
    execute: async () => { throw new Error('not used'); },
    ...capabilities,
  };
}

describe('route price evaluation', () => {
  it.each([
    ['constant request', { unit: 'request', unitPriceUsd: 0.5, quantity: { kind: 'constant', value: 1 } }, {}, 0.5],
    ['field seconds', { unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' } }, { duration: 5 }, 0.5],
    ['numeric string seconds', { unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' } }, { duration: '8s' }, 0.8],
    ['field default', { unit: 'image', unitPriceUsd: 0.04, quantity: { kind: 'field', pointer: '/num_images', default: 1 } }, {}, 0.04],
    ['characters', { unit: 'character', unitPriceUsd: 0.0001, quantity: { kind: 'characters', pointer: '/text' } }, { text: 'abcdefghij' }, 0.001],
    ['credits', { unit: 'credit', unitPriceUsd: 0.01, quantity: { kind: 'constant', value: 30 } }, {}, 0.3],
    ['megapixels', { unit: 'megapixel', unitPriceUsd: 0.02, quantity: { kind: 'field', pointer: '/megapixels' } }, { megapixels: 4 }, 0.08],
  ] as const)('computes %s', (_name, component, request, amount) => {
    expect(evaluateRoutePrice(price([component as never]), request)).toMatchObject({ kind: 'computed', amountUsd: amount });
  });

  it.each([
    ['a size label in thousands of pixels', { resolution: '2k' }, 0.08, 'about 4 megapixels (guessed from resolution "2k") × $0.02'],
    ['a square size label', { resolution: '512sq' }, 0.0052, 'about 0.26 megapixels (guessed from resolution "512sq") × $0.02'],
    ['width and height', { image_size: { width: 1920, height: 1080 } }, 0.0414, 'about 2.07 megapixels (1920 × 1080 pixels) × $0.02'],
    ['a pixel size label and an image count', { size: '1024x1024', num_images: 2 }, 0.042, '2 images × about 1.05 megapixels (guessed from size "1024x1024") × $0.02'],
    ['no size', {}, 0.02, 'about 1 megapixel (the request names no size, so 1 megapixel is assumed) × $0.02'],
  ] as const)('guesses image megapixels from %s', (_name, request, amount, basis) => {
    const perMegapixel = price([{ unit: 'megapixel', unitPriceUsd: 0.02, quantity: { kind: 'imageMegapixels', countPointer: '/num_images' } }]);
    expect(evaluateRoutePrice(perMegapixel, request)).toEqual({ kind: 'computed', amountUsd: amount, basis });
  });

  it('uses the first tier whose fields match, comparing text case-insensitively', () => {
    const tiered = price([{ unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' }, tiers: [
      { when: { '/resolution': '720p' }, unitPriceUsd: 0.1 },
      { when: { '/resolution': '1080p' }, unitPriceUsd: 0.2 },
    ] }]);
    expect(evaluateRoutePrice(tiered, { duration: 5, resolution: '1080P' })).toEqual({ kind: 'computed', amountUsd: 1, basis: '5 seconds × $0.2' });
    expect(evaluateRoutePrice(tiered, { duration: 5, resolution: '4k' })).toMatchObject({ kind: 'unpriced' });
  });

  it('sums components and stays unpriced when a quantity is missing or the vocabulary cannot express the price', () => {
    const two = price([
      { unit: 'request', unitPriceUsd: 0.1, quantity: { kind: 'constant', value: 1 } },
      { unit: 'second', unitPriceUsd: 0.05, quantity: { kind: 'field', pointer: '/duration' } },
    ]);
    expect(evaluateRoutePrice(two, { duration: 4 })).toMatchObject({ kind: 'computed', amountUsd: 0.3 });
    expect(evaluateRoutePrice(two, {})).toMatchObject({ kind: 'unpriced' });
    expect(evaluateRoutePrice(price([], { notes: ['Billed per token.'] }), {})).toEqual({ kind: 'unpriced', note: 'Billed per token.' });
  });
});

describe('route price schema', () => {
  it('accepts a complete recorded price', () => {
    const value = price([{ unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' } }]);
    expect(parseRoutePrice(value, { provider: 'acme', model: 'acme/video' })).toEqual(value);
  });

  it('reports every issue together', () => {
    try {
      parseRoutePrice({ currency: 'EUR', components: [{ unit: 'token', unitPriceUsd: -1, quantity: { kind: 'field', pointer: 'duration' } }], source: { kind: 'guess' }, notes: [1] }, { provider: 'acme', model: 'acme/video' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe('ENGINE_PRICE_INVALID');
      expect((error as EngineError).details).toHaveLength(7);
    }
  });
});

describe('cost estimates', () => {
  const request = { model: 'acme/video', input: { duration: 5 } };
  const recordedPrice = price([{ unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' } }]);

  it('prefers the recorded entry over the API price', async () => {
    const readPrice = vi.fn(async () => price([{ unit: 'request', unitPriceUsd: 9, quantity: { kind: 'constant', value: 1 } }]));
    const engine = createMediaEngine([provider({ readPrice })]);
    const ctx = context();
    await engine.recordRoutePrice('acme', 'acme/video', recordedPrice, ctx);
    expect(await engine.estimateCost('acme', request, ctx)).toMatchObject({ state: 'computed', amountUsd: 0.5, sourceUrl: 'https://example.test/pricing' });
    expect(readPrice).not.toHaveBeenCalled();
  });

  it('uses the API price when no recorded entry exists', async () => {
    const engine = createMediaEngine([provider({ readPrice: async () => price([{ unit: 'request', unitPriceUsd: 0.9, quantity: { kind: 'constant', value: 1 } }], { source: { kind: 'providerApi', observedAt: NOW.toISOString() } }) })]);
    expect(await engine.estimateCost('acme', request, context())).toMatchObject({ state: 'computed', amountUsd: 0.9 });
  });

  it('applies the route schema defaults before matching a price tier', async () => {
    const tiered = price([{ unit: 'image', unitPriceUsd: 0.04, quantity: { kind: 'constant', value: 1 }, tiers: [
      { when: { '/resolution': '1k' }, unitPriceUsd: 0.02 },
      { when: { '/resolution': '2k' }, unitPriceUsd: 0.05 },
    ] }], { source: { kind: 'providerApi', observedAt: NOW.toISOString() } });
    const engine = createMediaEngine([provider({
      readPrice: async () => tiered,
      readInputSchema: async () => ({ type: 'object', properties: { prompt: { type: 'string' }, resolution: { type: 'string', default: '1k' } } }),
    })]);
    expect(await engine.estimateCost('acme', { model: 'acme/image', input: {} }, context())).toMatchObject({ state: 'computed', amountUsd: 0.02 });
    expect(await engine.estimateCost('acme', { model: 'acme/image', input: { resolution: '2k' } }, context())).toMatchObject({ state: 'computed', amountUsd: 0.05 });
  });

  it('prices an explicit single-image request independently of the route batch default', async () => {
    const engine = createMediaEngine([provider({
      readPrice: async () => price([{ unit: 'image', unitPriceUsd: 0.05, quantity: { kind: 'field', pointer: '/num_images', default: 1 } }]),
      readInputSchema: async () => ({ type: 'object', properties: { num_images: { type: 'integer', default: 4 } } }),
    })]);
    expect(await engine.estimateCost('acme', { model: 'acme/image', input: {} }, context())).toMatchObject({ amountUsd: 0.2 });
    expect(await engine.estimateCost('acme', { model: 'acme/image', input: { num_images: 1 } }, context())).toMatchObject({ amountUsd: 0.05 });
  });

  it('prices one output at the route defaults when there is no request', async () => {
    const engine = createMediaEngine([provider({
      readPrice: async () => price([{ unit: 'image', unitPriceUsd: 0.05, quantity: { kind: 'field', pointer: '/num_images', default: 1 } }]),
      readInputSchema: async () => ({ type: 'object', properties: { num_images: { type: 'integer', default: 4 } } }),
    })]);
    expect(await engine.estimateRouteDefaultsCost('acme', 'acme/image', context())).toMatchObject({ state: 'computed', amountUsd: 0.05 });
    const perMegapixel = createMediaEngine([provider({
      readPrice: async () => price([{ unit: 'megapixel', unitPriceUsd: 0.02, quantity: { kind: 'imageMegapixels', countPointer: '/num_images' } }]),
      readInputSchema: async () => ({ type: 'object', properties: { num_images: { type: 'integer', default: 3 }, image_size: { type: 'string', default: '2k' } } }),
    })]);
    expect(await perMegapixel.estimateRouteDefaultsCost('acme', 'acme/image', context())).toMatchObject({ amountUsd: 0.08 });
  });

  it('prices one output at the route defaults with given native fields set over them', async () => {
    const tiered = price([{ unit: 'image', unitPriceUsd: 0.05, quantity: { kind: 'field', pointer: '/num_images', default: 1 }, tiers: [
      { when: { '/resolution': '1K' }, unitPriceUsd: 0.05 },
      { when: { '/resolution': '4K' }, unitPriceUsd: 0.2 },
    ] }]);
    const engine = createMediaEngine([provider({
      readPrice: async () => tiered,
      readInputSchema: async () => ({ type: 'object', properties: { resolution: { type: 'string', default: '1K' }, num_images: { type: 'integer', default: 2 } } }),
    })]);
    expect(await engine.estimateRouteDefaultsCost('acme', 'acme/image', context())).toMatchObject({ amountUsd: 0.05 });
    expect(await engine.estimateRouteDefaultsCost('acme', 'acme/image', context(), { resolution: '4K' })).toMatchObject({ amountUsd: 0.2 });
  });

  it('prefers a saved provider quote for the exact settings and reuses it for later estimates', async () => {
    const quoteCost = vi.fn(async () => ({ amountUsd: 0.095, sourceUrl: 'https://example.test/acme/image' }));
    const engine = createMediaEngine([provider({
      readPrice: async () => price([{ unit: 'request', unitPriceUsd: 0.36, quantity: { kind: 'constant', value: 1 } }]),
      readInputSchema: async () => ({ type: 'object', required: ['prompt'], properties: { prompt: { type: 'string' }, resolution: { type: 'string', default: '1K' } } }),
      quoteCost,
    })]);
    const ctx = context();
    expect(await engine.estimateRouteDefaultsCost('acme', 'acme/image', ctx)).toEqual({
      state: 'computed', amountUsd: 0.095, basis: 'Provider quote for one output at default settings', observedAt: NOW.toISOString(), sourceUrl: 'https://example.test/acme/image', notes: [],
    });
    expect(quoteCost).toHaveBeenCalledWith('acme/image', { prompt: 'Price estimate', resolution: '1K' }, expect.anything());
    await engine.estimateRouteDefaultsCost('acme', 'acme/image', ctx);
    expect(quoteCost).toHaveBeenCalledTimes(1);
    expect(await engine.estimateCost('acme', { model: 'acme/image', input: { prompt: 'Rain', resolution: '4K' } }, ctx)).toMatchObject({ amountUsd: 0.095, basis: 'Provider quote for these settings' });
    expect(quoteCost).toHaveBeenLastCalledWith('acme/image', { prompt: 'Rain', resolution: '4K' }, expect.anything());
    expect(quoteCost).toHaveBeenCalledTimes(2);
  });

  it('falls back to the published price when the quote fails, and says why only when that price cannot be computed', async () => {
    const failing = async () => { throw new EngineError('ENGINE_PROVIDER_UNAVAILABLE', 'Provider request timed out.', { provider: 'acme' }); };
    const published = createMediaEngine([provider({ readPrice: async () => price([{ unit: 'request', unitPriceUsd: 0.36, quantity: { kind: 'constant', value: 1 } }]), quoteCost: failing })]);
    expect(await published.estimateCost('acme', request, context())).toMatchObject({ state: 'computed', amountUsd: 0.36, notes: [] });
    const tokens = createMediaEngine([provider({ readPrice: async () => price([], { notes: ['Billed per token.'] }), quoteCost: failing })]);
    expect(await tokens.estimateCost('acme', request, context())).toMatchObject({
      state: 'unpriced', basis: 'Billed per token.', notes: ['The provider quote was unavailable: Provider request timed out.'],
    });
  });

  it('states an unpriced reason once', async () => {
    const engine = createMediaEngine([provider({ readPrice: async () => price([], { notes: ['Billed per token.'] }) })]);
    expect(await engine.estimateCost('acme', request, context())).toMatchObject({ state: 'unpriced', basis: 'Billed per token.', notes: [] });
  });

  it('reports a missing price without an amount', async () => {
    const engine = createMediaEngine([provider()]);
    expect(await engine.estimateCost('acme', request, context())).toEqual({ state: 'missingPrice', basis: 'No price is known for this route', notes: [] });
  });

  it('keeps a recorded entry however old it is', async () => {
    const engine = createMediaEngine([provider({ readPrice: async () => null })]);
    const ctx = context({ clock: () => new Date('2027-10-12T12:00:00.000Z') });
    const stored = await engine.recordRoutePrice('acme', 'acme/video', recordedPrice, ctx);
    expect(await engine.readRoutePrice('acme', 'acme/video', ctx)).toEqual(stored);
    expect(await engine.estimateCost('acme', request, ctx)).toMatchObject({ state: 'computed', amountUsd: 0.5 });
  });

  it('runs provider metadata reads with the estimate reuse policy', async () => {
    const contexts: ProviderContext[] = [];
    const engine = createMediaEngine([provider({
      readPrice: async (_model, ctx) => { contexts.push(ctx); return null; },
      readInputSchema: async (_model, ctx) => { contexts.push(ctx); return { type: 'object' }; },
    })]);
    await engine.estimateCost('acme', request, context({ requestTimeoutMs: 30_000 }));
    expect(contexts.map((ctx) => [ctx.requestTimeoutMs, ctx.cachedMetadataReuse])).toEqual([
      [5_000, { maxAgeMs: 30 * 24 * 60 * 60 * 1000, failedRefreshes: new Set() }],
      [5_000, { maxAgeMs: 30 * 24 * 60 * 60 * 1000, failedRefreshes: new Set() }],
    ]);
  });

  it('rejects an invalid recorded entry before storing it', async () => {
    const engine = createMediaEngine([provider()]);
    const ctx = context();
    await expect(engine.recordRoutePrice('acme', 'acme/video', { currency: 'USD' }, ctx)).rejects.toMatchObject({ code: 'ENGINE_PRICE_INVALID' });
    expect(await engine.readRoutePrice('acme', 'acme/video', ctx)).toBeNull();
  });
});
