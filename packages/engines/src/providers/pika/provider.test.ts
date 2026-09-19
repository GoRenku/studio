import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryProviderMetadataCache,
} from '../../shared/metadata-cache.js';
import { createMediaEngine } from '../../media/engine.js';
import type {
  JsonValue,
  ProviderExecutionContext,
  ProviderMetadataCache,
} from '../../media/contracts.js';
import { createPikaMediaProvider } from './provider.js';

const MODEL = 'minimax/h3/image-to-video';
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => fs.rm(directory, { recursive: true, force: true }),
  ));
});

describe('Pika media provider metadata', () => {
  it('coalesces no-store catalog reads and returns the exact raw schema through the provider and engine', async () => {
    const schema = inputSchema();
    const metadataCache: ProviderMetadataCache = {
      read: vi.fn(async () => null),
      write: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      expect(String(url)).toBe(
        'https://api.dev.pika.art/catalog/apis/minimax/h3/image-to-video?expand=inputs',
      );
      await gate;
      return Response.json(catalog(schema), {
        headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
      });
    });
    const context = await providerContext(fetchMock, metadataCache);
    const provider = createPikaMediaProvider();
    const engine = createMediaEngine([provider]);
    const providerRead = provider.readInputSchema!(MODEL, context);
    const engineRead = engine.readInputSchema('pika', MODEL, context);
    release();

    await expect(providerRead).resolves.toEqual(schema);
    await expect(engineRead).resolves.toEqual(schema);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(metadataCache.write).not.toHaveBeenCalled();
  });

  it('fails closed for unavailable and malformed catalog records', async () => {
    const cases: Array<{ body?: JsonValue; status?: number; code: string }> = [
      { status: 404, code: 'ENGINE_METADATA_UNAVAILABLE' },
      { body: catalog(inputSchema(), { api_id: 'different/operation' }), code: 'ENGINE_METADATA_INVALID' },
      { body: catalog(inputSchema(), { category: 'llm' }), code: 'ENGINE_METADATA_INVALID' },
      { body: catalog(inputSchema(), { call: { method: 'GET', path: '/v1/media/minimax/h3/image-to-video' } }), code: 'ENGINE_METADATA_INVALID' },
      { body: catalog(inputSchema(), { call: { method: 'POST', path: '/v1/media/../billing/balance' } }), code: 'ENGINE_METADATA_INVALID' },
      { body: catalog({ type: 'not-a-json-schema-type' }), code: 'ENGINE_METADATA_INVALID' },
    ];
    for (const testCase of cases) {
      const fetchMock = vi.fn<typeof fetch>(async () => testCase.status
        ? Response.json({ message: 'not found' }, { status: testCase.status })
        : Response.json(testCase.body));
      const context = await providerContext(fetchMock);
      await expect(createPikaMediaProvider().readInputSchema!(MODEL, context))
        .rejects.toMatchObject({ code: testCase.code });
    }
  });

  it.each([
    '',
    '/minimax/h3',
    'minimax/h3/',
    'minimax/../billing',
    'minimax/h3?expand=outputs',
    'minimax/h3#fragment',
    'minimax\\h3',
  ])('rejects unsafe operation id %j before making a catalog request', async (model) => {
    const fetchMock = vi.fn<typeof fetch>();
    const context = await providerContext(fetchMock);

    await expect(createPikaMediaProvider().readInputSchema!(model, context))
      .rejects.toMatchObject({ code: 'ENGINE_METADATA_UNAVAILABLE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Pika media provider execution', () => {
  it.each([MODEL, 'fixture/unindexed/image-to-video'])('uploads, submits, polls, and downloads exact route %s', async (model) => {
    const directory = await makeTemporaryDirectory();
    const referencePath = path.join(directory, 'first-frame.png');
    await fs.writeFile(referencePath, 'reference-bytes');
    const calls: Array<{ url: string; init?: Parameters<typeof fetch>[1] }> = [];
    let pollCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const requestUrl = String(url);
      calls.push({ url: requestUrl, init });
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(inputSchema(), { api_id: model, call: { method: 'POST', path: `/v1/media/${model}` } }), {
          headers: { 'cache-control': 'no-store' },
        });
      }
      if (requestUrl === 'https://api.dev.pika.art/v1/media/uploads') {
        return Response.json({
          upload_url: 'https://storage.example/signed?X-Amz-Signature=temporary',
          headers: { 'Content-Type': 'image/png', 'Content-Length': '15', 'x-signed': 'exact' },
          url: 'https://cdn.pika.art/hosted-input.png',
        });
      }
      if (requestUrl.startsWith('https://storage.example/signed')) {
        return new Response(null, { status: 200 });
      }
      if (requestUrl === `https://api.dev.pika.art/v1/media/${model}`) {
        return Response.json({ id: 'media_job_1', status: 'queued' });
      }
      if (requestUrl === 'https://api.dev.pika.art/v1/media/jobs/media_job_1') {
        pollCount += 1;
        return Response.json({
          id: 'media_job_1',
          status: pollCount === 1 ? 'running' : 'completed',
        });
      }
      if (requestUrl === 'https://api.dev.pika.art/v1/media/jobs/media_job_1/content') {
        return Response.json({ url: 'https://outputs.example/result.mp4?temporary=1' });
      }
      if (requestUrl.startsWith('https://outputs.example/result.mp4')) {
        return new Response(new TextEncoder().encode('video-bytes'), {
          headers: { 'content-type': 'video/mp4' },
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const context = await providerContext(fetchMock);
    const request = {
      model,
      input: {
        prompt: 'A short opaque motion prompt.',
        first_frame_image: {
          $file: referencePath,
          mimeType: 'image/png',
          reviewLabel: 'Reviewed first frame',
          promptMention: 'Frame 1',
        },
        duration: 4,
        resolution: '768P',
      },
    } as const;
    const reviewedRequest = structuredClone(request);

    const result = await createPikaMediaProvider().execute(request, context);

    expect(request).toEqual(reviewedRequest);
    const grant = calls.find((call) => call.url.endsWith('/v1/media/uploads'))!;
    expect(JSON.parse(String(grant.init?.body))).toEqual({
      content_type: 'image/png',
      size_bytes: 15,
    });
    expect(new Headers(grant.init?.headers).get('X-API-Key')).toBe('pika-secret');
    expect(grant.init?.redirect).toBe('error');

    const signedPut = calls.find((call) => call.url.startsWith('https://storage.example'))!;
    expect(signedPut.init?.method).toBe('PUT');
    expect(Object.fromEntries(new Headers(signedPut.init?.headers))).toEqual({
      'content-length': '15',
      'content-type': 'image/png',
      'x-signed': 'exact',
    });
    expect(new Headers(signedPut.init?.headers).has('X-API-Key')).toBe(false);
    expect(signedPut.init?.redirect).toBe('error');

    const submit = calls.find((call) => call.url.endsWith(`/v1/media/${model}`))!;
    const submittedBody = JSON.parse(String(submit.init?.body));
    expect(submittedBody).toEqual({
      prompt: 'A short opaque motion prompt.',
      first_frame_image: 'https://cdn.pika.art/hosted-input.png',
      duration: 4,
      resolution: '768P',
    });
    expect(new Headers(submit.init?.headers).get('Idempotency-Key')).toMatch(/^renku-/);
    expect(submit.init?.redirect).toBe('error');
    expect(result).toMatchObject({
      provider: 'pika',
      model,
      requestId: 'media_job_1',
      artifacts: [{ mimeType: 'video/mp4', byteLength: 11 }],
      receipt: { requestId: 'media_job_1', status: 'completed', mediaType: 'video' },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('pika-secret');
    expect(serialized).not.toContain('X-Amz-Signature');
    expect(serialized).not.toContain('hosted-input');
    expect(serialized).not.toContain('outputs.example');
    expect(serialized).not.toContain(referencePath);
    const output = calls.find((call) => call.url.startsWith('https://outputs.example'))!;
    expect(new Headers(output.init?.headers).has('X-API-Key')).toBe(false);
  });

  it.each([
    [401, 'ENGINE_AUTHENTICATION_FAILED', 1],
    [403, 'ENGINE_AUTHENTICATION_FAILED', 1],
    [409, 'ENGINE_REQUEST_REJECTED', 1],
    [422, 'ENGINE_REQUEST_INVALID', 1],
    [429, 'ENGINE_RATE_LIMITED', 3],
    [503, 'ENGINE_PROVIDER_UNAVAILABLE', 3],
  ])('maps submit HTTP %i to %s', async (status, code, expectedAttempts) => {
    let submitCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      submitCount += 1;
      return Response.json(
        { message: 'safe provider message' },
        { status, headers: status === 429 ? { 'retry-after': '1' } : undefined },
      );
    });
    const context = await providerContext(fetchMock);

    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: { prompt: 'motion' },
    }, context)).rejects.toMatchObject({ code, httpStatus: status });
    expect(submitCount).toBe(expectedAttempts);
  });

  it('validates schema-local media kinds, file limits, and request shape before upload', async () => {
    const directory = await makeTemporaryDirectory();
    const videoPath = path.join(directory, 'reference.mp4');
    await fs.writeFile(videoPath, 'video');
    const largeImagePath = path.join(directory, 'large.png');
    await fs.writeFile(largeImagePath, 'x');
    await fs.truncate(largeImagePath, 20 * 1024 * 1024 + 1);
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(catalog(inputSchema())));
    const context = await providerContext(fetchMock);
    const provider = createPikaMediaProvider();

    await expect(provider.validate({
      model: MODEL,
      input: { prompt: 'motion', first_frame_image: { $file: videoPath, mimeType: 'video/mp4' } },
    }, context)).rejects.toMatchObject({ code: 'ENGINE_LOCAL_MEDIA_INVALID' });
    await expect(provider.validate({
      model: MODEL,
      input: { prompt: 'motion', first_frame_image: { $file: largeImagePath, mimeType: 'image/png' } },
    }, context)).rejects.toMatchObject({ code: 'ENGINE_LOCAL_MEDIA_INVALID' });
    await expect(provider.validate({
      model: MODEL,
      input: { first_frame_image: 'https://example.com/frame.png' },
    }, context)).rejects.toMatchObject({ code: 'ENGINE_REQUEST_INVALID' });
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/catalog/apis/'))).toBe(true);
  });

  it.each([
    [413, 'ENGINE_LOCAL_MEDIA_INVALID', 1],
    [415, 'ENGINE_LOCAL_MEDIA_INVALID', 1],
    [429, 'ENGINE_RATE_LIMITED', 3],
    [500, 'ENGINE_UPLOAD_FAILED', 1],
    [503, 'ENGINE_PROVIDER_UNAVAILABLE', 3],
  ])('maps upload-grant HTTP %i to %s without submitting', async (
    status,
    code,
    expectedGrantAttempts,
  ) => {
    const directory = await makeTemporaryDirectory();
    const referencePath = path.join(directory, 'first-frame.png');
    await fs.writeFile(referencePath, 'image');
    const calls: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const requestUrl = String(url);
      calls.push(requestUrl);
      return requestUrl.includes('/catalog/apis/')
        ? Response.json(catalog(inputSchema()))
        : Response.json({ message: 'upload rejected' }, { status });
    });
    const context = await providerContext(fetchMock);

    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: {
        prompt: 'motion',
        first_frame_image: { $file: referencePath, mimeType: 'image/png' },
      },
    }, context)).rejects.toMatchObject({ code, httpStatus: status });
    expect(calls.filter((url) => url.endsWith('/v1/media/uploads')))
      .toHaveLength(expectedGrantAttempts);
    expect(calls).not.toContain('https://api.dev.pika.art/v1/media/minimax/h3/image-to-video');
  });

  it('retries upload-grant request timeouts without submitting', async () => {
    const directory = await makeTemporaryDirectory();
    const referencePath = path.join(directory, 'first-frame.png');
    await fs.writeFile(referencePath, 'image');
    let grantAttempts = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).includes('/catalog/apis/')) {
        return Response.json(catalog(inputSchema()));
      }
      grantAttempts += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    const context = await providerContext(fetchMock);
    context.requestTimeoutMs = 1;

    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: {
        prompt: 'motion',
        first_frame_image: { $file: referencePath, mimeType: 'image/png' },
      },
    }, context)).rejects.toMatchObject({ code: 'ENGINE_PROVIDER_UNAVAILABLE' });
    expect(grantAttempts).toBe(3);
  });

  it('retries uncertain submission with the same key and terminal provider failure once with a fresh key', async () => {
    const submitKeys: string[] = [];
    let submitAttempt = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      if (requestUrl.endsWith('/minimax/h3/image-to-video')) {
        submitKeys.push(new Headers(init?.headers).get('Idempotency-Key')!);
        submitAttempt += 1;
        if (submitAttempt === 1) {
          throw new TypeError('uncertain transport');
        }
        if (submitAttempt === 2) {
          return Response.json({
            id: 'failed_job',
            status: 'failed',
            error: { code: 'provider_unavailable', message: 'temporary' },
          }, { status: 503 });
        }
        return Response.json({ id: 'completed_job', status: 'completed' });
      }
      if (requestUrl.endsWith('/completed_job/content')) {
        return Response.json({ url: 'https://outputs.example/retry.mp4' });
      }
      if (requestUrl === 'https://outputs.example/retry.mp4') {
        return new Response(new TextEncoder().encode('video'), {
          headers: { 'content-type': 'video/mp4' },
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const context = await providerContext(fetchMock);
    const result = await createPikaMediaProvider().execute({
      model: MODEL,
      input: { prompt: 'motion' },
    }, context);

    expect(result.requestId).toBe('completed_job');
    expect(submitKeys).toHaveLength(3);
    expect(submitKeys[0]).toBe(submitKeys[1]);
    expect(submitKeys[2]).not.toBe(submitKeys[1]);
  });

  it('does not resubmit when polling exhausts transient retries for an accepted job', async () => {
    let submitCount = 0;
    let pollCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      if (requestUrl.endsWith('/minimax/h3/image-to-video')) {
        submitCount += 1;
        return Response.json({ id: 'accepted_job', status: 'queued' });
      }
      if (requestUrl.endsWith('/jobs/accepted_job')) {
        pollCount += 1;
        return Response.json({ message: 'temporarily unavailable' }, { status: 503 });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const context = await providerContext(fetchMock);

    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: { prompt: 'motion' },
    }, context)).rejects.toMatchObject({
      code: 'ENGINE_PROVIDER_UNAVAILABLE',
      requestId: 'accepted_job',
      retryable: true,
    });
    expect(submitCount).toBe(1);
    expect(pollCount).toBe(3);
  });

  it('does not start a terminal retry that cannot fit within the original deadline', async () => {
    let nowMs = 0;
    let submitCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      submitCount += 1;
      nowMs = 4_900;
      return Response.json({
        id: 'failed_job',
        status: 'failed',
        error: { code: 'provider_unavailable' },
      });
    });
    const context = await providerContext(fetchMock);
    context.clock = () => new Date(nowMs);

    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: { prompt: 'motion' },
    }, context)).rejects.toMatchObject({
      code: 'ENGINE_OPERATION_TIMEOUT',
      requestId: 'failed_job',
    });
    expect(submitCount).toBe(1);
  });

  it('passes only the original deadline remainder to a terminal retry poll', async () => {
    let nowMs = 0;
    let submitCount = 0;
    let pollCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      if (requestUrl.endsWith('/minimax/h3/image-to-video')) {
        submitCount += 1;
        if (submitCount === 1) {
          nowMs = 4_900;
          return Response.json({
            id: 'failed_job',
            status: 'failed',
            error: { code: 'provider_unavailable' },
          }, { status: 503, headers: { 'retry-after': '0.05' } });
        }
        return Response.json({ id: 'retry_job', status: 'queued' });
      }
      if (requestUrl.endsWith('/jobs/retry_job')) {
        pollCount += 1;
        nowMs = 5_001;
        return Response.json({ id: 'retry_job', status: 'running' });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const context = await providerContext(fetchMock);
    context.clock = () => new Date(nowMs);
    context.sleep = async (milliseconds) => { nowMs += milliseconds; };

    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: { prompt: 'motion' },
    }, context)).rejects.toMatchObject({
      code: 'ENGINE_OPERATION_TIMEOUT',
      requestId: 'retry_job',
    });
    expect(submitCount).toBe(2);
    expect(pollCount).toBe(1);
  });

  it.each([
    ['invalid_input', 'ENGINE_REQUEST_INVALID'],
    ['content_moderation', 'ENGINE_REQUEST_REJECTED'],
    ['insufficient_balance', 'ENGINE_REQUEST_REJECTED'],
    ['membership_required', 'ENGINE_REQUEST_REJECTED'],
    ['cycle_limit_exceeded', 'ENGINE_REQUEST_REJECTED'],
    ['admission_suspended', 'ENGINE_REQUEST_REJECTED'],
    ['provider_timeout', 'ENGINE_OPERATION_TIMEOUT'],
    ['timed_out', 'ENGINE_OPERATION_TIMEOUT'],
    ['provider_error', 'ENGINE_JOB_FAILED'],
    ['internal', 'ENGINE_JOB_FAILED'],
    ['future_error', 'ENGINE_JOB_FAILED'],
  ])('maps failed job %s to %s without resubmitting', async (providerCode, engineCode) => {
    let submitCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      submitCount += 1;
      return Response.json({
        id: 'failed_job',
        status: 'failed',
        error: { code: providerCode, message: 'provider detail' },
      });
    });
    const context = await providerContext(fetchMock);
    await expect(createPikaMediaProvider().execute({
      model: MODEL,
      input: { prompt: 'motion' },
    }, context)).rejects.toMatchObject({ code: engineCode, requestId: 'failed_job' });
    expect(submitCount).toBe(1);
  });

  it('recovers a known job without validating local files or resubmitting', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const requestUrl = String(url);
      calls.push(requestUrl);
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(inputSchema()));
      }
      if (requestUrl.endsWith('/jobs/recovery_job')) {
        return Response.json({ id: 'recovery_job', status: 'completed' });
      }
      if (requestUrl.endsWith('/jobs/recovery_job/content')) {
        return Response.json({ url: 'https://outputs.example/recovered.mp4' });
      }
      if (requestUrl.endsWith('/recovered.mp4')) {
        return new Response(new TextEncoder().encode('video'), {
          headers: { 'content-type': 'video/mp4' },
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const context = await providerContext(fetchMock);
    const result = await createPikaMediaProvider().recover!({
      model: MODEL,
      requestId: 'recovery_job',
      input: {
        prompt: 'motion',
        first_frame_image: { $file: '/missing/review-file.png', mimeType: 'image/png' },
      },
    }, context);

    expect(result.requestId).toBe('recovery_job');
    expect(calls).not.toContain('https://api.dev.pika.art/v1/media/minimax/h3/image-to-video');
  });

  it('maps an unknown recovery job and rejects a mismatched downloaded media kind', async () => {
    const recoveryFetch = vi.fn<typeof fetch>(async (url) => String(url).includes('/catalog/apis/')
      ? Response.json(catalog(textSchema()))
      : Response.json({ message: 'not found' }, { status: 404 }));
    await expect(createPikaMediaProvider().recover!({
      model: MODEL,
      requestId: 'unknown',
      input: { prompt: 'motion' },
    }, await providerContext(recoveryFetch))).rejects.toMatchObject({ code: 'ENGINE_RECOVERY_FAILED' });

    const outputFetch = vi.fn<typeof fetch>(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/catalog/apis/')) {
        return Response.json(catalog(textSchema()));
      }
      if (requestUrl.endsWith('/image-job/content')) {
        return Response.json({ url: 'https://outputs.example/wrong.png' });
      }
      if (requestUrl.endsWith('/image-job')) {
        return Response.json({ id: 'image-job', status: 'completed' });
      }
      if (requestUrl.endsWith('/wrong.png')) {
        return new Response(new TextEncoder().encode('pixels'), {
          headers: { 'content-type': 'image/png' },
        });
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    const outputContext = await providerContext(outputFetch);
    await expect(createPikaMediaProvider().recover!({
      model: MODEL,
      requestId: 'image-job',
      input: { prompt: 'motion' },
    }, outputContext)).rejects.toMatchObject({ code: 'ENGINE_OUTPUT_INVALID' });
    await expect(fs.readdir(outputContext.outputDirectory)).resolves.toEqual([]);
  });
});

function inputSchema(): JsonValue {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['prompt', 'first_frame_image'],
    properties: {
      prompt: { type: 'string', minLength: 1 },
      first_frame_image: {
        type: 'string',
        pattern: '^https?://',
        media_kinds: ['image'],
      },
      duration: { type: 'integer', minimum: 4, maximum: 15 },
      resolution: { type: 'string', enum: ['768P', '2K'] },
    },
  };
}

function textSchema(): JsonValue {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['prompt'],
    properties: { prompt: { type: 'string', minLength: 1 } },
  };
}

function catalog(
  schema: JsonValue,
  overrides: Record<string, JsonValue> = {},
): JsonValue {
  return {
    api_id: MODEL,
    category: 'video',
    call: { method: 'POST', path: '/v1/media/minimax/h3/image-to-video' },
    input_schema: schema,
    ...overrides,
  };
}

async function providerContext(
  fetchMock: typeof fetch,
  metadataCache: ProviderMetadataCache = createMemoryProviderMetadataCache(),
): Promise<ProviderExecutionContext> {
  const outputDirectory = await makeTemporaryDirectory();
  return {
    credential: 'pika-secret',
    metadataCache,
    fetch: fetchMock,
    signal: new AbortController().signal,
    requestTimeoutMs: 1_000,
    operationTimeoutMs: 5_000,
    outputDirectory,
    sleep: async () => undefined,
    random: () => 0,
  };
}

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-pika-provider-'));
  temporaryDirectories.push(directory);
  return directory;
}
