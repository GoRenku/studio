import { describe, expect, it, vi } from 'vitest';
import { createMemoryProviderMetadataCache } from '@gorenku/studio-engines';
import { createRenkuMediaEngine } from './provider-registry.js';

describe('generation provider registry', () => {
  it('constructs Pika through the standalone Engines public entrypoint', async () => {
    const schema = {
      type: 'object',
      required: ['prompt'],
      properties: { prompt: { type: 'string' } },
    };
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({
      api_id: 'vendor/model/text-to-video',
      category: 'video',
      call: { method: 'POST', path: '/v1/media/vendor/model/text-to-video' },
      input_schema: schema,
    }, { headers: { 'cache-control': 'no-store' } }));

    await expect(createRenkuMediaEngine().readInputSchema(
      'pika',
      'vendor/model/text-to-video',
      {
        credential: 'test-only-pika-key',
        metadataCache: createMemoryProviderMetadataCache(),
        fetch: fetchMock,
        signal: new AbortController().signal,
        requestTimeoutMs: 1_000,
        operationTimeoutMs: 5_000,
      },
    )).resolves.toEqual(schema);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
