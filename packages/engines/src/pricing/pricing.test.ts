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
    expiresAt: '2026-10-20T00:00:00.000Z',
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
      parseRoutePrice({ currency: 'EUR', components: [{ unit: 'token', unitPriceUsd: -1, quantity: { kind: 'field', pointer: 'duration' } }], source: { kind: 'guess' }, expiresAt: 'soon', notes: [1] }, { provider: 'acme', model: 'acme/video' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe('ENGINE_PRICE_INVALID');
      expect((error as EngineError).details).toHaveLength(8);
    }
  });
});

describe('cost estimates', () => {
  const request = { model: 'acme/video', input: { duration: 5 } };
  const recordedPrice = price([{ unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' } }]);

  it('prefers a live quote', async () => {
    const engine = createMediaEngine([provider({
      quoteCost: async () => ({ amountUsd: 0.84, sourceUrl: 'https://example.test/quote' }),
      readPrice: async () => { throw new Error('not reached'); },
    })]);
    expect(await engine.estimateCost('acme', request, context())).toEqual({
      state: 'quoted', amountUsd: 0.84, basis: 'Provider quote for this request', observedAt: NOW.toISOString(), sourceUrl: 'https://example.test/quote', notes: [],
    });
  });

  it('falls back from a failed quote to a fresh recorded entry before the API price', async () => {
    const readPrice = vi.fn(async () => price([{ unit: 'request', unitPriceUsd: 9, quantity: { kind: 'constant', value: 1 } }]));
    const engine = createMediaEngine([provider({
      quoteCost: async () => { throw new EngineError('ENGINE_REQUEST_REJECTED', 'Quote rejected.', { provider: 'acme' }); },
      readPrice,
    })]);
    const ctx = context();
    await engine.recordRoutePrice('acme', 'acme/video', recordedPrice, ctx);
    const estimate = await engine.estimateCost('acme', request, ctx);
    expect(estimate).toMatchObject({ state: 'computed', amountUsd: 0.5, sourceUrl: 'https://example.test/pricing' });
    expect(estimate.notes[0]).toContain('Quote rejected.');
    expect(readPrice).not.toHaveBeenCalled();
  });

  it('uses the API price when no fresh recorded entry exists', async () => {
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

  it('states an unpriced reason once', async () => {
    const engine = createMediaEngine([provider({ readPrice: async () => price([], { notes: ['Billed per token.'] }) })]);
    expect(await engine.estimateCost('acme', request, context())).toMatchObject({ state: 'unpriced', basis: 'Billed per token.', notes: [] });
  });

  it('reports expired and missing prices without an amount', async () => {
    const engine = createMediaEngine([provider()]);
    const ctx = context();
    expect(await engine.estimateCost('acme', request, ctx)).toEqual({ state: 'missingPrice', basis: 'No price is known for this route', notes: [] });
    await engine.recordRoutePrice('acme', 'acme/video', { ...recordedPrice, expiresAt: '2026-10-11T00:00:00.000Z' }, ctx);
    const expired = await engine.estimateCost('acme', request, ctx);
    expect(expired).toMatchObject({ state: 'expired', observedAt: recordedPrice.source.observedAt });
    expect(expired).not.toHaveProperty('amountUsd');
  });

  it('caps a recorded entry at fourteen days and reads both cached prices', async () => {
    const engine = createMediaEngine([provider({ readPrice: async () => null })]);
    const ctx = context();
    const stored = await engine.recordRoutePrice('acme', 'acme/video', { ...recordedPrice, expiresAt: '2027-01-01T00:00:00.000Z' }, ctx);
    expect(stored.expiresAt).toBe('2026-10-24T00:00:00.000Z');
    expect(await engine.readRoutePrices('acme', 'acme/video', ctx)).toEqual({ recorded: stored, providerApi: null });
  });

  it('rejects an invalid recorded entry before storing it', async () => {
    const engine = createMediaEngine([provider()]);
    const ctx = context();
    await expect(engine.recordRoutePrice('acme', 'acme/video', { currency: 'USD' }, ctx)).rejects.toMatchObject({ code: 'ENGINE_PRICE_INVALID' });
    expect((await engine.readRoutePrices('acme', 'acme/video', ctx)).recorded).toBeNull();
  });
});
