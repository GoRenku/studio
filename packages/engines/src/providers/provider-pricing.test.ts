import { describe, expect, it, vi } from 'vitest';
import type { ProviderContext } from '../media/contracts.js';
import { createMemoryProviderMetadataCache } from '../shared/metadata-cache.js';
import { createFalMediaProvider } from './fal-ai/index.js';
import { createPikaMediaProvider } from './pika/index.js';
import { createWaveSpeedMediaProvider } from './wavespeed/index.js';
import { loadPikaOperationMetadata } from './pika/metadata.js';
import { loadWaveSpeedInputSchema } from './wavespeed/metadata.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');

function context(fetch: typeof globalThis.fetch): ProviderContext {
  return {
    credential: 'test-key',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch,
    clock: () => NOW,
    sleep: async () => undefined,
    signal: new AbortController().signal,
    requestTimeoutMs: 1000,
    operationTimeoutMs: 1000,
  };
}

function fetchMock(handler: (url: string, init?: Parameters<typeof globalThis.fetch>[1]) => Response) {
  return vi.fn(async (input: string | URL | Request, init?: Parameters<typeof globalThis.fetch>[1]) => handler(String(input), init)) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>;
}

describe('Pika pricing', () => {
  const displayPricing = { components: [{ role: 'output', unit: { type: 'second', quantity: 1, included: 0 },
    starting_at: { spec: { resolution: '720p' }, sell_usd: '0.098', micro_usd: 98000 },
    price_tiers: [{ spec: { resolution: '720p' }, sell_usd: '0.098', micro_usd: 98000 }, { spec: { resolution: '1080p' }, sell_usd: '0.168', micro_usd: 168000 }] }] };

  it('maps catalog display pricing to tiered seconds', async () => {
    const fetch = fetchMock(() => Response.json({ api_id: 'acme/video', display_pricing: displayPricing,
      category: 'video', call: { method: 'POST', path: '/v1/media/clip' }, input_schema: { type: 'object' } }));
    const ctx = context(fetch);
    const price = await createPikaMediaProvider().readPrice!('acme/video', ctx);
    expect(price).toMatchObject({
      components: [{ unit: 'second', unitPriceUsd: 0.098, quantity: { kind: 'field', pointer: '/duration' }, tiers: [
        { when: { '/resolution': '720p' }, unitPriceUsd: 0.098 },
        { when: { '/resolution': '1080p' }, unitPriceUsd: 0.168 },
      ] }],
      source: { kind: 'providerApi', url: 'https://api.dev.pika.art/catalog/apis/acme/video' },
      notes: [],
      expiresAt: '2026-10-13T12:00:00.000Z',
    });
    await loadPikaOperationMetadata('acme/video', ctx);
    await createPikaMediaProvider().readPrice!('acme/video', ctx);
    expect(fetch).toHaveBeenCalledTimes(1);
    ctx.clock = () => new Date('2026-10-13T12:00:00.000Z');
    await createPikaMediaProvider().readPrice!('acme/video', ctx);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stays unpriced for units the vocabulary cannot express', async () => {
    const fetch = fetchMock(() => Response.json({ api_id: 'acme/video', display_pricing: { components: [{ role: 'output', unit: { type: 'video_output_token' }, starting_at: { micro_usd: 10 } }] } }));
    const price = await createPikaMediaProvider().readPrice!('acme/video', context(fetch));
    expect(price?.components).toEqual([]);
    expect(price?.notes[0]).toContain('video output token');
  });

  it('quotes the exact native request through the public quote endpoint', async () => {
    const fetch = fetchMock(() => Response.json({ sell_usd: '0.84', micro_usd: 840000 }));
    const quote = await createPikaMediaProvider().quoteCost!('acme/video', { prompt: 'x', duration: 5, image: { $file: '/tmp/a.png' } }, context(fetch));
    expect(quote).toEqual({ amountUsd: 0.84, sourceUrl: 'https://api.dev.pika.art/catalog/apis/acme/video/quote' });
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://api.dev.pika.art/catalog/apis/acme/video/quote');
    expect(new Headers(init?.headers).has('X-API-Key')).toBe(false);
    expect(JSON.parse(String(init?.body))).toMatchObject({ prompt: 'x', duration: 5 });
  });

  it('rejects a quote without an amount', async () => {
    const fetch = fetchMock(() => Response.json({}));
    await expect(createPikaMediaProvider().quoteCost!('acme/video', {}, context(fetch))).rejects.toMatchObject({ code: 'ENGINE_PRICE_INVALID' });
  });
});

describe('WaveSpeed pricing', () => {
  it('reads the base price from the cached model list', async () => {
    const fetch = fetchMock(() => Response.json({ code: 200, data: [{ model_id: 'acme/video', base_price: 0.9,
      api_schema: { api_schemas: [{ type: 'model_run', method: 'POST', request_schema: { type: 'object' } }] } }] }));
    const ctx = context(fetch);
    const price = await createWaveSpeedMediaProvider().readPrice!('acme/video', ctx);
    expect(price).toMatchObject({ components: [{ unit: 'request', unitPriceUsd: 0.9, quantity: { kind: 'constant', value: 1 } }], expiresAt: '2026-10-13T12:00:00.000Z' });
    await loadWaveSpeedInputSchema('acme/video', ctx);
    await createWaveSpeedMediaProvider().readPrice!('acme/video', ctx);
    expect(fetch).toHaveBeenCalledTimes(1);
    ctx.clock = () => new Date('2026-10-13T12:00:00.000Z');
    await createWaveSpeedMediaProvider().readPrice!('acme/video', ctx);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('quotes through the pricing endpoint with the model id and inputs', async () => {
    const fetch = fetchMock(() => Response.json({ code: 200, data: { model_id: 'acme/video', unit_price: 0.02, currency: 'USD' } }));
    const quote = await createWaveSpeedMediaProvider().quoteCost!('acme/video', { prompt: 'lake', duration: 1 }, context(fetch));
    expect(quote).toEqual({ amountUsd: 0.02, sourceUrl: 'https://api.wavespeed.ai/api/v3/model/pricing' });
    const [, init] = fetch.mock.calls[0]!;
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-key');
    expect(JSON.parse(String(init?.body))).toEqual({ model_id: 'acme/video', inputs: { prompt: 'lake', duration: 1 } });
  });

  it('reports a rejected quote as a structured engine error', async () => {
    const fetch = fetchMock(() => new Response('{}', { status: 400 }));
    await expect(createWaveSpeedMediaProvider().quoteCost!('acme/video', {}, context(fetch))).rejects.toMatchObject({ code: 'ENGINE_REQUEST_REJECTED', httpStatus: 400 });
  });
});

describe('Fal.ai pricing', () => {
  it('maps a per-image unit price and keeps it fresh for a day without expiry headers', async () => {
    const fetch = fetchMock(() => Response.json({ prices: [{ endpoint_id: 'acme/image', unit_price: 0.025, unit: 'image', currency: 'USD' }], next_cursor: null, has_more: false }));
    const ctx = context(fetch);
    const price = await createFalMediaProvider().readPrice!('acme/image', ctx);
    expect(price).toMatchObject({
      components: [{ unit: 'image', unitPriceUsd: 0.025, quantity: { kind: 'field', pointer: '/num_images', default: 1 } }],
      expiresAt: '2026-10-13T12:00:00.000Z',
    });
    expect(String(fetch.mock.calls[0]![0])).toBe('https://api.fal.ai/v1/models/pricing?endpoint_id=acme%2Fimage');
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get('Authorization')).toBe('Key test-key');
    await createFalMediaProvider().readPrice!('acme/image', ctx);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('maps a per-megapixel price to a guessed image size', async () => {
    const fetch = fetchMock(() => Response.json({ prices: [{ endpoint_id: 'acme/edit', unit_price: 0.024, unit: 'megapixels', currency: 'USD' }], next_cursor: null, has_more: false }));
    const price = await createFalMediaProvider().readPrice!('acme/edit', context(fetch));
    expect(price?.components).toEqual([{ unit: 'megapixel', unitPriceUsd: 0.024, quantity: { kind: 'imageMegapixels', countPointer: '/num_images' } }]);
  });

  it('stays unpriced for compute units and returns null without a price', async () => {
    const compute = fetchMock(() => Response.json({ prices: [{ endpoint_id: 'acme/image', unit_price: 0.001, unit: 'compute seconds', currency: 'USD' }], next_cursor: null, has_more: false }));
    expect((await createFalMediaProvider().readPrice!('acme/image', context(compute)))?.components).toEqual([]);
    const empty = fetchMock(() => Response.json({ prices: [], next_cursor: null, has_more: false }));
    expect(await createFalMediaProvider().readPrice!('acme/image', context(empty))).toBeNull();
  });
});
