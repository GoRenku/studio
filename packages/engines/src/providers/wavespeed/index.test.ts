import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ProviderExecutionContext } from '../../media/contracts.js';
import { createMemoryProviderMetadataCache } from '../../shared/metadata-cache.js';
import { createWaveSpeedMediaProvider } from './index.js';

describe('WaveSpeed media provider', () => {
  it('uploads with Retry-After, submits once, polls a known task, and downloads output', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-wavespeed-provider-'));
    const reference = path.join(directory, 'reference.png');
    await fs.writeFile(reference, 'reference');
    let uploadAttempts = 0;
    let submitAttempts = 0;
    let pollAttempts = 0;
    const delays: number[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const value = String(url);
      if (value === 'https://api.wavespeed.ai/api/v3/models') {
        return Response.json(metadata(), { headers: { 'cache-control': 'max-age=60' } });
      }
      if (value.endsWith('/media/upload/binary')) {
        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          return new Response(null, { status: 429, headers: { 'retry-after': '3' } });
        }
        return Response.json({ data: { download_url: 'https://wavespeed.media/upload.png' } });
      }
      if (value.endsWith('/future/image-model') && init?.method === 'POST') {
        submitAttempts += 1;
        return Response.json({ data: { id: 'task_1' } });
      }
      if (value.endsWith('/predictions/task_1/result')) {
        pollAttempts += 1;
        return pollAttempts === 1
          ? Response.json({ data: { id: 'task_1', status: 'processing' } })
          : Response.json({
              data: {
                id: 'task_1',
                status: 'completed',
                outputs: ['https://wavespeed.media/output.mp4'],
                timings: { inference: 4.2 },
              },
            });
      }
      if (value === 'https://wavespeed.media/output.mp4') {
        return new Response(new TextEncoder().encode('video'), {
          headers: { 'content-type': 'video/mp4' },
        });
      }
      throw new Error(`Unexpected request: ${value}`);
    });
    const context: ProviderExecutionContext = {
      credential: 'wavespeed-secret',
      metadataCache: createMemoryProviderMetadataCache(),
      fetch: fetchMock,
      signal: new AbortController().signal,
      requestTimeoutMs: 1_000,
      operationTimeoutMs: 10_000,
      outputDirectory: directory,
      sleep: async (milliseconds) => { delays.push(milliseconds); },
      random: () => 0,
    };

    const result = await createWaveSpeedMediaProvider().execute({
      model: 'future/image-model',
      input: {
        prompt: 'A stone arch',
        image: { $file: reference, mimeType: 'image/png' },
      },
    }, context);

    expect(uploadAttempts).toBe(2);
    expect(submitAttempts).toBe(1);
    expect(pollAttempts).toBe(2);
    expect(delays).toEqual([3_000, 2_000]);
    expect(result).toMatchObject({
      provider: 'wavespeed-ai',
      model: 'future/image-model',
      requestId: 'task_1',
      artifacts: [{ mimeType: 'video/mp4', byteLength: 5 }],
      receipt: { requestId: 'task_1', status: 'completed' },
    });
  });
});

function metadata() {
  return {
    data: [{
      model_id: 'future/image-model',
      api_schema: {
        api_schemas: [{
          type: 'model_run',
          method: 'POST',
          request_schema: {
            type: 'object',
            required: ['prompt', 'image'],
            properties: {
              prompt: { type: 'string' },
              image: { type: 'string', format: 'uri' },
            },
          },
        }],
      },
    }],
  };
}
