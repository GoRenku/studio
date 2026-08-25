import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderExecutionContext } from '../../media/contracts.js';
import { createMemoryProviderMetadataCache } from '../../shared/metadata-cache.js';

const replicate = vi.hoisted(() => ({
  createPrediction: vi.fn(),
  getPrediction: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock('replicate', () => ({
  default: class Replicate {
    predictions = {
      create: replicate.createPrediction,
      get: replicate.getPrediction,
    };
    files = { create: replicate.uploadFile };
  },
}));

import { createReplicateMediaProvider } from './index.js';

describe('Replicate media provider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses live schema metadata, retries throttled submit, and normalizes output URLs', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-replicate-provider-'));
    const reference = path.join(directory, 'reference.png');
    await fs.writeFile(reference, 'reference');
    replicate.uploadFile.mockResolvedValue({ urls: { get: 'https://replicate.delivery/upload.png' } });
    replicate.createPrediction
      .mockRejectedValueOnce({ status: 429, response: new Response(null, {
        status: 429,
        headers: { 'retry-after': '2' },
      }) })
      .mockResolvedValue({ id: 'prediction_1' });
    replicate.getPrediction.mockResolvedValue({
      id: 'prediction_1',
      status: 'succeeded',
      output: { url: () => new URL('https://replicate.delivery/output.webp') },
      metrics: { predict_time: 2.4 },
    });
    const delays: number[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const value = String(url);
      if (value === 'https://api.replicate.com/v1/models/owner/future-model') {
        return Response.json(modelMetadata(), { headers: { 'cache-control': 'max-age=60' } });
      }
      if (value === 'https://replicate.delivery/output.webp') {
        return new Response(new TextEncoder().encode('webp'), {
          headers: { 'content-type': 'image/webp' },
        });
      }
      throw new Error(`Unexpected request: ${value}`);
    });
    const context = providerContext(directory, fetchMock, delays);
    const provider = createReplicateMediaProvider();

    const result = await provider.execute({
      model: 'owner/future-model',
      input: {
        prompt: 'A stone arch',
        image: { $file: reference, mimeType: 'image/png' },
      },
    }, context);

    expect(delays).toEqual([2_000]);
    expect(replicate.createPrediction).toHaveBeenCalledTimes(2);
    expect(replicate.createPrediction).toHaveBeenLastCalledWith({
      model: 'owner/future-model',
      input: { prompt: 'A stone arch', image: 'https://replicate.delivery/upload.png' },
      signal: context.signal,
    });
    expect(result).toMatchObject({
      provider: 'replicate',
      requestId: 'prediction_1',
      artifacts: [{ mimeType: 'image/webp', byteLength: 4 }],
      receipt: { requestId: 'prediction_1', status: 'succeeded' },
    });
  });
});

function modelMetadata() {
  return {
    latest_version: {
      openapi_schema: {
        components: {
          schemas: {
            Input: {
              type: 'object',
              required: ['prompt', 'image'],
              properties: {
                prompt: { type: 'string' },
                image: { type: 'string', format: 'uri' },
              },
            },
          },
        },
      },
    },
  };
}

function providerContext(
  outputDirectory: string,
  fetchMock: typeof fetch,
  delays: number[],
): ProviderExecutionContext {
  return {
    credential: 'replicate-secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: fetchMock,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 10_000,
    outputDirectory,
    sleep: async (milliseconds) => { delays.push(milliseconds); },
    random: () => 0,
  };
}
