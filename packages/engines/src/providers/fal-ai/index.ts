import { Blob } from 'node:buffer';
import { createFalClient, ApiError, type FalClient } from '@fal-ai/client';
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
import { loadFalInputSchema } from './metadata.js';
import { normalizeFalOutput } from './outputs.js';

export function createFalMediaProvider(): MediaProvider {
  return {
    id: 'fal-ai',
    async readInputSchema(model, context) {
      requireCredential(model, context);
      return loadFalInputSchema(model, context);
    },
    async validate(request, context) {
      requireCredential(request.model, context);
      validateJsonSchema({
        provider: 'fal-ai',
        model: request.model,
        schema: await loadFalInputSchema(request.model, context),
        value: replaceLocalMediaFilesWithValidationUrls(request.input),
      });
    },
    async execute(request, context) {
      await this.validate(request, context);
      const client = createClient(context, request.model);
      const input = await uploadLocalFiles(client, request, context);
      validateJsonSchema({
        provider: 'fal-ai',
        model: request.model,
        schema: await loadFalInputSchema(request.model, context),
        value: input,
      });
      let submitted: { request_id: string };
      try {
        submitted = await withProviderRetries({
          provider: 'fal-ai', model: request.model, context, maxAttempts: 3,
          classify: classifyRetry,
          operation: () => client.queue.submit(request.model, {
            input: asObject(input, request.model),
            abortSignal: context.signal,
          }),
        });
      } catch (error) {
        throw normalizeError(error, request.model, 'ENGINE_SUBMIT_FAILED');
      }
      return recoverFal(client, request, submitted.request_id, context);
    },
    async recover(request, context) {
      requireCredential(request.model, context);
      return recoverFal(createClient(context, request.model), request, request.requestId, context);
    },
  };
}

async function recoverFal(
  client: FalClient,
  request: ProviderRequest,
  requestId: string,
  context: ProviderExecutionContext,
): Promise<ProviderExecutionResult> {
  const endpoint = request.model;
  await pollProviderJob({
    provider: 'fal-ai',
    model: request.model,
    requestId,
    context,
    intervalMs: 3_000,
    poll: () => client.queue.status(endpoint, { requestId, abortSignal: context.signal }),
    pollRetry: { maxAttempts: 3, classify: classifyRetry },
    classify: (status) => status.status === 'COMPLETED' ? 'completed' : 'pending',
    failureMessage: () => 'Fal.ai job failed.',
  });
  let result;
  try {
    result = await withProviderRetries({
      provider: 'fal-ai', model: request.model, context, maxAttempts: 3,
      classify: classifyRetry,
      operation: () => client.queue.result(endpoint, {
        requestId,
        abortSignal: context.signal,
      }),
    });
  } catch (error) {
    throw normalizeError(error, request.model, 'ENGINE_RECOVERY_FAILED', requestId);
  }
  const output = toJsonValue(result.data, request.model, requestId);
  const urls = normalizeFalOutput(output);
  if (urls.length === 0) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'Fal.ai returned no media output.', {
      provider: 'fal-ai', model: request.model, requestId,
    });
  }
  return {
    provider: 'fal-ai',
    model: request.model,
    requestId,
    artifacts: await downloadProviderOutputs({
      provider: 'fal-ai', model: request.model, requestId, urls, context,
    }),
    receipt: { requestId, output },
  };
}

function createClient(context: ProviderContext, model: string): FalClient {
  return createFalClient({
    credentials: context.credential,
    fetch: createRequestTimeoutFetch({ provider: 'fal-ai', model, context }),
    retry: { maxRetries: 0 },
  });
}

async function uploadLocalFiles(
  client: FalClient,
  request: ProviderRequest,
  context: ProviderExecutionContext,
): Promise<JsonValue> {
  return substituteLocalMediaFiles(
    request.input,
    'fal-ai',
    request.model,
    async (file) => client.storage.upload(
      new Blob([file.bytes], { type: file.mimeType ?? 'application/octet-stream' }),
    ),
  );
}

function requireCredential(model: string, context: ProviderContext): void {
  if (!context.credential) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'Fal.ai credential is required.', {
      provider: 'fal-ai', model,
    });
  }
}

function asObject(value: JsonValue, model: string): Record<string, JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EngineError('ENGINE_REQUEST_INVALID', 'Fal.ai input must be an object.', {
      provider: 'fal-ai', model,
    });
  }
  return value;
}

function normalizeError(
  error: unknown,
  model: string,
  fallback: 'ENGINE_SUBMIT_FAILED' | 'ENGINE_RECOVERY_FAILED',
  requestId?: string,
): EngineError {
  const status = error instanceof ApiError ? error.status : undefined;
  const code = status === 401 || status === 403
    ? 'ENGINE_AUTHENTICATION_FAILED'
    : status === 429
      ? 'ENGINE_RATE_LIMITED'
      : status !== undefined && status >= 400 && status < 500
        ? 'ENGINE_REQUEST_REJECTED'
        : fallback;
  return new EngineError(code, error instanceof Error ? error.message : 'Fal.ai request failed.', {
    provider: 'fal-ai', model, requestId, httpStatus: status,
    retryable: status === 429 || (status !== undefined && status >= 500), cause: error,
  });
}

function classifyRetry(error: unknown): { retryable: boolean; retryAfterMs?: number } {
  const status = error instanceof ApiError ? error.status : undefined;
  return {
    retryable: status === undefined || status === 429 || status >= 500,
    ...(readRetryAfter(error) === undefined ? {} : { retryAfterMs: readRetryAfter(error) }),
  };
}

function readRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }
  const response = error.response;
  if (!(response instanceof Response)) {
    return undefined;
  }
  const value = Number(response.headers.get('retry-after'));
  return Number.isFinite(value) ? Math.max(0, value * 1_000) : undefined;
}

function toJsonValue(value: unknown, model: string, requestId: string): JsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch (error) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'Fal.ai returned a non-JSON response.', {
      provider: 'fal-ai', model, requestId, cause: error,
    });
  }
}
