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

  it.each(['max-age=0, must-revalidate', 'no-store'])('reuses one schema with %s during execution, but refreshes the next operation', async (cacheControl) => {
    const model = 'fixture/unindexed-image';
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-provider-'));
    const reference = path.join(directory, 'reference.png');
    await fs.writeFile(reference, 'reference');
    fal.upload.mockResolvedValue('https://fal.media/uploaded.png');
    fal.submit.mockResolvedValue({ request_id: 'fal_job_1' });
    fal.status.mockResolvedValue({ status: 'COMPLETED' });
    fal.result.mockResolvedValue({
      data: { images: [{ url: 'https://fal.media/output.png' }] },
    });
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const value = String(url);
      if (value.startsWith('https://api.fal.ai/v1/models')) {
        expect(new URL(value).searchParams.get('endpoint_id')).toBe(model);
        expect(new Headers(init?.headers).get('Authorization')).toBe('Key fal-secret');
        return Response.json(modelSearchResponse(model), {
          headers: { 'cache-control': cacheControl },
        });
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
      model,
      input: {
        prompt: 'A stone arch',
        image_url: { $file: reference, mimeType: 'image/png' },
      },
    };

    const result = await provider.execute(request, context);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://api.fal.ai/'))).toHaveLength(1);
    await provider.validate(request, context);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://api.fal.ai/'))).toHaveLength(2);
    expect(fal.upload).toHaveBeenCalledOnce();
    expect(fal.submit).toHaveBeenCalledWith(model, {
      input: { prompt: 'A stone arch', image_url: 'https://fal.media/uploaded.png' },
      abortSignal: context.signal,
    });
    expect(fal.status).toHaveBeenCalledWith(model, {
      requestId: 'fal_job_1',
      abortSignal: context.signal,
    });
    expect(fal.result).toHaveBeenCalledWith(model, {
      requestId: 'fal_job_1',
      abortSignal: context.signal,
    });
    expect(result).toMatchObject({
      provider: 'fal-ai',
      model,
      requestId: 'fal_job_1',
      artifacts: [{ mimeType: 'image/png', byteLength: 6 }],
      receipt: { requestId: 'fal_job_1' },
    });
  });

  it.each(['before-upload', 'after-upload', 'upload-failure', 'cancelled'])('does not submit when %s fails', async (stage) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-validation-'));
    const reference = path.join(directory, 'reference.png');
    await fs.writeFile(reference, 'reference');
    const model = 'fixture/image';
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(modelSearchResponse(model), {
      headers: { 'cache-control': 'no-store' },
    }));
    const context = await providerContext(directory, fetchMock);
    if (stage === 'cancelled') {
      context.signal = AbortSignal.abort();
    }
    fal.upload.mockResolvedValue(stage === 'after-upload' ? 'invalid-uri' : 'https://fal.media/upload.png');
    if (stage === 'upload-failure') {
      fal.upload.mockRejectedValue(new Error('upload failed'));
    }
    await expect(createFalMediaProvider().execute({ model, input: {
      ...(stage === 'before-upload' ? {} : { prompt: 'Test' }),
      image_url: { $file: reference, mimeType: 'image/png' },
    } }, context)).rejects.toBeDefined();
    expect(fal.submit).not.toHaveBeenCalled();
    if (stage === 'before-upload' || stage === 'cancelled') {
      expect(fal.upload).not.toHaveBeenCalled();
    } else {
      expect(fal.upload).toHaveBeenCalledOnce();
    }
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('preserves an exact Fal-owned endpoint during schema inspection', async () => {
    const model = 'fal-ai/nano-banana-2';
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      expect(new URL(String(url)).searchParams.get('endpoint_id')).toBe(model);
      return Response.json(modelSearchResponse(model));
    });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-provider-'));
    const provider = createFalMediaProvider();

    await expect(provider.readInputSchema!(
      model,
      await providerContext(directory, fetchMock),
    )).resolves.toMatchObject({ type: 'object' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects a guide model key before requesting provider metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-provider-'));
    const provider = createFalMediaProvider();

    await expect(provider.readInputSchema!(
      'grok-imagine-image',
      await providerContext(directory, fetchMock),
    )).rejects.toMatchObject({
      code: 'ENGINE_REQUEST_INVALID',
      message: 'Fal.ai model must be the exact provider endpoint id, including its namespace.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects metadata that does not contain the exact requested endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(modelSearchResponse('xai/another-image-model'))
    );
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-provider-'));
    const provider = createFalMediaProvider();

    await expect(provider.readInputSchema!(
      'xai/grok-imagine-image',
      await providerContext(directory, fetchMock),
    )).rejects.toMatchObject({
      code: 'ENGINE_METADATA_UNAVAILABLE',
      message: 'Fal.ai endpoint "xai/grok-imagine-image" was not found in live provider metadata.',
    });
  });

  it('rejects more than three Seed Audio voice references before metadata lookup', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fal-provider-'));
    const provider = createFalMediaProvider();

    await expect(provider.validate({
      model: 'bytedance/seed-audio-1.0',
      input: {
        prompt: 'Four speakers.',
        audio_urls: [1, 2, 3, 4].map((number) => ({
          $file: path.join(directory, `voice-${number}.mp3`),
          mimeType: 'audio/mpeg',
        })),
      },
    }, await providerContext(directory, fetchMock))).rejects.toMatchObject({
      code: 'ENGINE_REQUEST_INVALID',
      message: 'Seed Audio 1.0 accepts at most three local voice references.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function modelSearchResponse(model: string) {
  return {
    models: [{
      endpoint_id: model,
      openapi: {
        paths: {
          '/provider/inference': {
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
      },
    }],
    has_more: false,
    next_cursor: null,
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
