import { describe, expect, it, vi } from 'vitest';
import type { ProviderContext, ProviderMetadataCacheKey } from '../media/contracts.js';
import { createMemoryProviderMetadataCache } from './metadata-cache.js';
import { retrieveProviderMetadata } from './metadata-retrieval.js';

const key: ProviderMetadataCacheKey = {
  provider: 'atlas',
  model: 'image-v1',
  url: 'https://atlas.invalid/schema',
};

describe('provider metadata retrieval', () => {
  it('uses a fresh cache entry without network access', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const context = providerContext(fetchMock);
    await context.metadataCache.write(key, {
      body: { schema: 1 },
      fetchedAt: '2026-08-24T00:00:00.000Z',
      expiresAt: '2026-08-24T00:02:00.000Z',
    });
    await expect(retrieveProviderMetadata({ key, context })).resolves.toMatchObject({
      body: { schema: 1 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('conditionally refreshes expired metadata and keeps its exact body on 304', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      expect(new Headers(init?.headers).get('if-none-match')).toBe('schema-1');
      return new Response(null, {
        status: 304,
        headers: { etag: 'schema-1', 'cache-control': 'max-age=60' },
      });
    });
    const context = providerContext(fetchMock);
    await context.metadataCache.write(key, {
      body: { schema: 1 },
      fetchedAt: '2026-08-23T00:00:00.000Z',
      expiresAt: '2026-08-23T00:01:00.000Z',
      etag: 'schema-1',
    });
    const result = await retrieveProviderMetadata({ key, context });
    expect(result.body).toEqual({ schema: 1 });
    expect(result.fetchedAt).toBe('2026-08-24T00:00:00.000Z');
    expect(result.expiresAt).toBe('2026-08-24T00:01:00.000Z');
  });

  it('coalesces concurrent no-store reads but fetches again for a later invocation', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn<typeof fetch>(async () => {
      await gate;
      return Response.json({ schema: 1 }, {
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
      });
    });
    const context = providerContext(fetchMock);
    const first = retrieveProviderMetadata({ key, context });
    const second = retrieveProviderMetadata({ key, context });
    release?.();
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(await context.metadataCache.read(key)).toBeNull();
    await retrieveProviderMetadata({ key, context });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not serve stale metadata after mandatory revalidation fails', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    const context = providerContext(fetchMock);
    await context.metadataCache.write(key, {
      body: { stale: true },
      fetchedAt: '2026-08-23T00:00:00.000Z',
      expiresAt: '2026-08-23T00:01:00.000Z',
    });
    await expect(retrieveProviderMetadata({ key, context })).rejects.toMatchObject({
      code: 'ENGINE_METADATA_UNAVAILABLE',
      httpStatus: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

function providerContext(fetchMock: typeof fetch): ProviderContext {
  return {
    credential: 'secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: fetchMock,
    clock: () => new Date('2026-08-24T00:00:00.000Z'),
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 10_000,
    sleep: async () => undefined,
    random: () => 0,
  };
}
