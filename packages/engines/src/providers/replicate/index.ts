import { Blob } from 'node:buffer';
import Replicate, { type Prediction } from 'replicate';
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
import { loadReplicateInputSchema, parseReplicateModel } from './metadata.js';
import { normalizeReplicateOutput } from './outputs.js';

export function createReplicateMediaProvider(): MediaProvider {
  return {
    id: 'replicate',
    async readInputSchema(model, context) {
      requireCredential(model, context);
      return loadReplicateInputSchema(model, context);
    },
    async validate(request, context) {
      requireCredential(request.model, context);
      validateJsonSchema({
        provider: 'replicate',
        model: request.model,
        schema: await loadReplicateInputSchema(request.model, context),
        value: replaceLocalMediaFilesWithValidationUrls(request.input),
      });
    },
    async execute(request, context) {
      await this.validate(request, context);
      const client = createClient(context, request.model);
      const input = await uploadLocalFiles(client, request, context);
      validateJsonSchema({
        provider: 'replicate',
        model: request.model,
        schema: await loadReplicateInputSchema(request.model, context),
        value: input,
      });
      const parsed = parseReplicateModel(request.model);
      let prediction: Prediction;
      try {
        prediction = await withProviderRetries({
          provider: 'replicate',
          model: request.model,
          context,
          maxAttempts: 3,
          classify: classifyRetry,
          operation: () => client.predictions.create({
            ...(parsed.version ? { version: parsed.version } : { model: `${parsed.owner}/${parsed.name}` }),
            input: asObject(input, request.model),
            signal: context.signal,
          }),
        });
      } catch (error) {
        throw normalizeError(error, request.model, 'ENGINE_SUBMIT_FAILED');
      }
      return recoverPrediction(client, request, prediction.id, context);
    },
    async recover(request, context) {
      requireCredential(request.model, context);
      return recoverPrediction(createClient(context, request.model), request, request.requestId, context);
    },
  };
}

async function recoverPrediction(
  client: Replicate,
  request: ProviderRequest,
  requestId: string,
  context: ProviderExecutionContext,
): Promise<ProviderExecutionResult> {
  let completed: Prediction;
  try {
    completed = await pollProviderJob({
      provider: 'replicate', model: request.model, requestId, context,
      intervalMs: 1_000,
      poll: () => client.predictions.get(requestId, { signal: context.signal }),
      pollRetry: { maxAttempts: 3, classify: classifyRetry },
      classify: (prediction) => {
        if (prediction.status === 'succeeded') {
          return 'completed';
        }
        if (prediction.status === 'failed' || prediction.status === 'canceled') {
          return 'failed';
        }
        return 'pending';
      },
      failureMessage: (prediction) => typeof prediction.error === 'string'
        ? prediction.error
        : 'Replicate prediction failed.',
    });
  } catch (error) {
    if (error instanceof EngineError) {
      throw error;
    }
    throw normalizeError(error, request.model, 'ENGINE_RECOVERY_FAILED', requestId);
  }
  const urls = normalizeReplicateOutput(completed.output);
  if (urls.length === 0) {
    throw new EngineError('ENGINE_OUTPUT_INVALID', 'Replicate returned no media output.', {
      provider: 'replicate', model: request.model, requestId,
    });
  }
  return {
    provider: 'replicate', model: request.model, requestId,
    artifacts: await downloadProviderOutputs({
      provider: 'replicate', model: request.model, requestId, urls, context,
    }),
    receipt: {
      requestId,
      status: completed.status,
      ...(toJsonValue(completed.metrics) === undefined ? {} : { metrics: toJsonValue(completed.metrics)! }),
    },
  };
}

function createClient(context: ProviderContext, model: string): Replicate {
  return new Replicate({
    auth: context.credential,
    fetch: createRequestTimeoutFetch({ provider: 'replicate', model, context }),
  });
}

async function uploadLocalFiles(
  client: Replicate,
  request: ProviderRequest,
  context: ProviderExecutionContext,
): Promise<JsonValue> {
  return substituteLocalMediaFiles(
    request.input, 'replicate', request.model,
    async (file) => {
      const uploaded = await client.files.create(
        new Blob([file.bytes], { type: file.mimeType ?? 'application/octet-stream' }),
        undefined,
        { signal: context.signal },
      );
      const url = uploaded.urls?.get;
      if (!url) {
        throw new Error('Replicate upload returned no URL.');
      }
      return url;
    },
  );
}

function classifyRetry(error: unknown): { retryable: boolean; retryAfterMs?: number } {
  const status = readStatus(error);
  return {
    retryable: status === 429 || (status !== undefined && status >= 500),
    ...(readRetryAfter(error) === undefined ? {} : { retryAfterMs: readRetryAfter(error) }),
  };
}

function normalizeError(
  error: unknown,
  model: string,
  fallback: 'ENGINE_SUBMIT_FAILED' | 'ENGINE_RECOVERY_FAILED',
  requestId?: string,
): EngineError {
  const status = readStatus(error);
  const code = status === 401 || status === 403
    ? 'ENGINE_AUTHENTICATION_FAILED'
    : status === 429
      ? 'ENGINE_RATE_LIMITED'
      : status !== undefined && status >= 400 && status < 500
        ? 'ENGINE_REQUEST_REJECTED'
        : fallback;
  return new EngineError(code, error instanceof Error ? error.message : 'Replicate request failed.', {
    provider: 'replicate', model, requestId, httpStatus: status,
    retryable: status === 429 || (status !== undefined && status >= 500), cause: error,
  });
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const value = 'status' in error ? error.status : undefined;
  return typeof value === 'number' ? value : undefined;
}

function readRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }
  const response = error.response;
  if (!(response instanceof Response)) {
    return undefined;
  }
  const value = response.headers.get('retry-after');
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1_000 : undefined;
}

function requireCredential(model: string, context: ProviderContext): void {
  if (!context.credential) {
    throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'Replicate credential is required.', {
      provider: 'replicate', model,
    });
  }
}

function asObject(value: JsonValue, model: string): Record<string, JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EngineError('ENGINE_REQUEST_INVALID', 'Replicate input must be an object.', {
      provider: 'replicate', model,
    });
  }
  return value;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}
