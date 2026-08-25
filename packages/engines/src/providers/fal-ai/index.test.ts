import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryProviderMetadataCache } from '../../shared/metadata-cache.js';
import type { ProviderExecutionContext } from '../../media/contracts.js';

const fal = vi.hoisted(() => ({
  upload: vi.fn(),
  submit: vi.fn(),
  status: vi.fn(),
  result: vi.fn(),
}));

vi.mock('@fal-ai/client', () => ({
  ApiError: class ApiError extends Error {
    status?: number;
  },
  createFalClient: () => ({
    storage: { upload: fal.upload },
    queue: { submit: fal.submit, status: fal.status, result: fal.result },
  }),
}));

import { createFalMediaProvider } from './index.js';

describe('Fal.ai media provider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates live metadata, uploads local media, polls, and downloads output', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-provider-'));
    const reference = path.join(directory, 'reference.png');
    await fs.writeFile(reference, 'reference');
    fal.upload.mockResolvedValue('https://fal.media/uploaded.png');
    fal.submit.mockResolvedValue({ request_id: 'fal_job_1' });
    fal.status.mockResolvedValue({ status: 'COMPLETED' });
    fal.result.mockResolvedValue({
      data: { images: [{ url: 'https://fal.media/output.png' }] },
    });
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const value = String(url);
      if (value.startsWith('https://fal.ai/api/openapi/queue/openapi.json')) {
        return Response.json(openApiSchema(), { headers: { 'cache-control': 'max-age=60' } });
      }
      if (value === 'https://fal.media/output.png') {
        return new Response(new TextEncoder().encode('pixels'), {
          headers: { 'content-type': 'image/png' },
        });
      }
      throw new Error(`Unexpected request: ${value}`);
    });
    const context = await providerContext(directory, fetchMock);
    const provider = createFalMediaProvider();
    const request = {
      model: 'future/image-model',
      input: {
        prompt: 'A stone arch',
        image_url: { $file: reference, mimeType: 'image/png' },
      },
    };

    const result = await provider.execute(request, context);

    expect(fal.upload).toHaveBeenCalledOnce();
    expect(fal.submit).toHaveBeenCalledWith('fal-ai/future/image-model', {
      input: { prompt: 'A stone arch', image_url: 'https://fal.media/uploaded.png' },
      abortSignal: context.signal,
    });
    expect(fal.status).toHaveBeenCalledWith('fal-ai/future/image-model', {
      requestId: 'fal_job_1',
      abortSignal: context.signal,
    });
    expect(result).toMatchObject({
      provider: 'fal-ai',
      model: 'future/image-model',
      requestId: 'fal_job_1',
      artifacts: [{ mimeType: 'image/png', byteLength: 6 }],
      receipt: { requestId: 'fal_job_1' },
    });
  });
});

function openApiSchema() {
  return {
    paths: {
      '/queue': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['prompt', 'image_url'],
                  properties: {
                    prompt: { type: 'string' },
                    image_url: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: { schemas: {} },
  };
}

async function providerContext(
  outputDirectory: string,
  fetchMock: typeof fetch,
): Promise<ProviderExecutionContext> {
  return {
    credential: 'fal-secret',
    metadataCache: createMemoryProviderMetadataCache(),
    fetch: fetchMock,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 5_000,
    outputDirectory,
    sleep: async () => undefined,
    random: () => 0,
  };
}
