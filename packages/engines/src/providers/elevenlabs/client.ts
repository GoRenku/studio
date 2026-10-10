import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { ProviderExecutionContext } from '../../media/contracts.js';
import { EngineError } from '../../shared/errors.js';
import { withProviderRetries } from '../../shared/retry.js';
import { createRequestTimeoutFetch } from '../../shared/request-timeout.js';

export async function requestElevenLabsAudio(input: {
  model: string;
  context: ProviderExecutionContext;
  send: (client: ElevenLabsClient) => Promise<ReadableStream<Uint8Array>>;
}): Promise<ReadableStream<Uint8Array>> {
  const { model, context } = input;
  try {
    const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
    const client = new ElevenLabsClient({
      apiKey: context.credential,
      fetch: createRequestTimeoutFetch({
        provider: 'elevenlabs',
        model,
        context,
      }),
      timeoutInSeconds: context.requestTimeoutMs / 1_000,
      maxRetries: 0,
    });
    return await withProviderRetries({
      provider: 'elevenlabs', model, context, maxAttempts: 3,
      classify: classifyRetry,
      operation: async () => input.send(client),
    });
  } catch (error) {
    throw normalizeError(error, model);
  }
}

function classifyRetry(error: unknown): { retryable: boolean; retryAfterMs?: number } {
  const status = readStatus(error);
  return {
    retryable: status === 429 || (status !== undefined && status >= 500),
    ...(readRetryAfter(error) === undefined ? {} : { retryAfterMs: readRetryAfter(error) }),
  };
}

function normalizeError(error: unknown, model: string): EngineError {
  const status = readStatus(error);
  const code = status === 401 || status === 403
    ? 'ENGINE_AUTHENTICATION_FAILED'
    : status === 429
      ? 'ENGINE_RATE_LIMITED'
      : status !== undefined && status >= 400 && status < 500
        ? 'ENGINE_REQUEST_REJECTED'
        : 'ENGINE_PROVIDER_UNAVAILABLE';
  return new EngineError(code, error instanceof Error ? error.message : 'ElevenLabs request failed.', {
    provider: 'elevenlabs', model, httpStatus: status,
    retryable: status === 429 || (status !== undefined && status >= 500), cause: error,
  });
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  for (const key of ['status', 'statusCode']) {
    const value = key in error ? error[key as keyof typeof error] : undefined;
    if (typeof value === 'number') {
      return value;
    }
  }
  return undefined;
}

function readRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('headers' in error)) {
    return undefined;
  }
  const headers = error.headers;
  if (!(headers instanceof Headers)) {
    return undefined;
  }
  const value = Number(headers.get('retry-after'));
  return Number.isFinite(value) ? value * 1_000 : undefined;
}
