import { Blob } from 'node:buffer';
import type {
  JsonValue,
  MediaProvider,
  ProviderContext,
  ProviderExecutionContext,
  ProviderExecutionResult,
  ProviderRequest,
} from '../../media/contracts.js';
import {
  replaceLocalMediaFilesWithValidationUrls,
  substituteLocalMediaFiles,
} from '../../media/local-files.js';
import { validateJsonSchema } from '../../shared/json-schema-validation.js';
import { downloadProviderOutputs } from '../../shared/downloads.js';
import { EngineError } from '../../shared/errors.js';
import { pollProviderJob } from '../../shared/polling.js';
import { withProviderRetries } from '../../shared/retry.js';
import { createRequestTimeoutFetch } from '../../shared/request-timeout.js';
import { loadWaveSpeedInputSchema } from './metadata.js';

const BASE_URL = 'https://api.wavespeed.ai/api/v3';

interface WaveSpeedResult {
  code?: JsonValue;
  message?: JsonValue;
  data?: JsonValue;
}

export function createWaveSpeedMediaProvider(): MediaProvider {
  return {
    id: 'wavespeed-ai',
    async readInputSchema(model, context) {
      requireCredential(model, context);
      return loadWaveSpeedInputSchema(model, context);
    },
    async validate(request, context) {
      requireCredential(request.model, context);
      validateJsonSchema({
        provider: 'wavespeed-ai',
        model: request.model,
        schema: await loadWaveSpeedInputSchema(request.model, context),
        value: replaceLocalMediaFilesWithValidationUrls(request.input),
      });
    },
    async execute(request, context) {
      await this.validate(request, context);
      const input = await uploadLocalFiles(request, context);
      validateJsonSchema({
        provider: 'wavespeed-ai',
        model: request.model,
        schema: await loadWaveSpeedInputSchema(request.model, context),
        value: input,
      });
      const response = await providerRequest(
        `${BASE_URL}/${request.model}`,
        { method: 'POST', body: JSON.stringify(input) },
        request.model,
        context,
        'ENGINE_SUBMIT_FAILED',
      );
      const body = await readJson(response, request.model);
      const requestId = readRequestId(body);
      if (!requestId) {
        throw new EngineError('ENGINE_OUTPUT_INVALID', 'WaveSpeed returned no task id.', {
          provider: 'wavespeed-ai', model: request.model,
        });
      }
      return recoverWaveSpeed(request, requestId, context);
    },
    async recover(request, context) {
      requireCredential(request.model, context);
      return recoverWaveSpeed(request, request.requestId, context);
    },
  };
}

async function recoverWaveSpeed(
  request: ProviderRequest,
  requestId: string,
  context: ProviderExecutionContext,
): Promise<ProviderExecutionResult> {
  const completed = await pollProviderJob({
    provider: 'wavespeed-ai', model: request.model, requestId, context,
    intervalMs: 2_000,
    poll: async () => readJson(
      await providerRequest(
        `${BASE_URL}/predictions/${encodeURIComponent(requestId)}/result`,
        { method: 'GET' },
        request.model,
        context,
        'ENGINE_POLL_FAILED',
        requestId,
        true,
      ),
      request.model,
      requestId,
    ),
    classify: (result) => {
      const status = readStatus(result);
      if (status === 'completed') {
        return 'completed';
      }
      if (['failed', 'cancelled', 'timeout'].includes(status ?? '')) {
        return 'failed';
      }
      return 'pending';
    },
    failureMessage: (result) => readError(result) ?? 'WaveSpeed task failed.',
  });
  const urls = readOutputs(completed);
  if (urls.length === 0) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'WaveSpeed returned no media output.', {
      provider: 'wavespeed-ai', model: request.model, requestId,
    });
  }
  return {
    provider: 'wavespeed-ai', model: request.model, requestId,
    artifacts: await downloadProviderOutputs({
      provider: 'wavespeed-ai', model: request.model, requestId, urls, context,
    }),
    receipt: {
      requestId,
      status: readStatus(completed) ?? 'completed',
      ...(readTimings(completed) === undefined ? {} : { timings: readTimings(completed)! }),
    },
  };
}

async function uploadLocalFiles(
  request: ProviderRequest,
  context: ProviderExecutionContext,
): Promise<JsonValue> {
  return substituteLocalMediaFiles(
    request.input, 'wavespeed-ai', request.model,
    async (file) => {
      const form = new FormData();
      form.set('file', new Blob([file.bytes], {
        type: file.mimeType ?? 'application/octet-stream',
      }), 'input');
      const response = await providerRequest(
        `${BASE_URL}/media/upload/binary`,
        { method: 'POST', body: form },
        request.model,
        context,
        'ENGINE_UPLOAD_FAILED',
        undefined,
        true,
      );
      const body = await readJson(response, request.model);
      const url = isRecord(body.data) ? body.data.download_url : undefined;
      if (typeof url !== 'string' || url.length === 0) {
        throw new EngineError('ENGINE_UPLOAD_FAILED', 'WaveSpeed upload returned no URL.', {
          provider: 'wavespeed-ai', model: request.model,
        });
      }
      return url;
    },
  );
}

async function providerRequest(
  url: string,
  init: NonNullable<Parameters<typeof fetch>[1]>,
  model: string,
  context: ProviderContext,
  fallback: 'ENGINE_SUBMIT_FAILED' | 'ENGINE_UPLOAD_FAILED' | 'ENGINE_POLL_FAILED',
  requestId?: string,
  safeToRetry = false,
): Promise<Response> {
  const operation = async (): Promise<Response> => {
    let response: Response;
    try {
      response = await createRequestTimeoutFetch({
        provider: 'wavespeed-ai',
        model,
        requestId,
        context,
      })(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${context.credential}`,
          ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: context.signal,
      });
    } catch (error) {
      throw new EngineError(
        context.signal.aborted ? 'ENGINE_CANCELLED' : fallback,
        'WaveSpeed request could not be completed.',
        { provider: 'wavespeed-ai', model, requestId, retryable: true, cause: error },
      );
    }
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? 'ENGINE_AUTHENTICATION_FAILED'
        : response.status === 429
          ? 'ENGINE_RATE_LIMITED'
          : response.status >= 400 && response.status < 500
            ? 'ENGINE_REQUEST_REJECTED'
            : 'ENGINE_PROVIDER_UNAVAILABLE';
      throw new EngineError(code, `WaveSpeed request failed with HTTP ${response.status}.`, {
        provider: 'wavespeed-ai', model, requestId, httpStatus: response.status,
        retryable: response.status === 429 || response.status >= 500,
        retryAfterMs: readRetryAfter(response),
      });
    }
    return response;
  };
  if (!safeToRetry) {
    return operation();
  }
  return withProviderRetries({
    provider: 'wavespeed-ai', model, context, maxAttempts: 3, operation,
    classify: (error) => error instanceof EngineError
      ? { retryable: error.retryable, retryAfterMs: error.retryAfterMs }
      : { retryable: false },
  });
}

function readRetryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1_000) : undefined;
}

async function readJson(
  response: Response,
  model: string,
  requestId?: string,
): Promise<WaveSpeedResult> {
  const value = await response.json() as unknown;
  if (!isRecord(value)) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'WaveSpeed returned malformed JSON.', {
      provider: 'wavespeed-ai', model, requestId,
    });
  }
  return value;
}

function readRequestId(value: WaveSpeedResult): string | undefined {
  return isRecord(value.data) && typeof value.data.id === 'string' ? value.data.id : undefined;
}

function readStatus(value: WaveSpeedResult): string | undefined {
  return isRecord(value.data) && typeof value.data.status === 'string' ? value.data.status : undefined;
}

function readError(value: WaveSpeedResult): string | undefined {
  return isRecord(value.data) && typeof value.data.error === 'string' ? value.data.error : undefined;
}

function readOutputs(value: WaveSpeedResult): string[] {
  return isRecord(value.data) && Array.isArray(value.data.outputs)
    ? value.data.outputs.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
}

function readTimings(value: WaveSpeedResult): JsonValue | undefined {
  return isRecord(value.data) ? value.data.timings : undefined;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireCredential(model: string, context: ProviderContext): void {
  if (!context.credential) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'WaveSpeed credential is required.', {
      provider: 'wavespeed-ai', model,
    });
  }
}
