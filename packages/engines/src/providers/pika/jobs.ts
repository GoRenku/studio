import { createHash, randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type {
  GeneratedMediaArtifact,
  JsonValue,
  ProviderExecutionContext,
} from '../../media/contracts.js';
import { downloadProviderOutputs } from '../../shared/downloads.js';
import { EngineError } from '../../shared/errors.js';
import { pollProviderJob } from '../../shared/polling.js';
import { createRequestTimeoutFetch } from '../../shared/request-timeout.js';
import { withProviderRetries } from '../../shared/retry.js';
import {
  parsePikaJob,
  pikaHttpError,
  pikaJobFailure,
  readPikaResponseBody,
  readRetryAfter,
  type PikaJob,
} from './errors.js';
import {
  PIKA_ORIGIN,
  type PikaMediaCategory,
  type PikaOperationMetadata,
} from './metadata.js';

export async function submitPikaJob(input: {
  metadata: PikaOperationMetadata;
  body: JsonValue;
  context: ProviderExecutionContext;
  idempotencyKey?: string;
}): Promise<{ job: PikaJob; retryAfterMs?: number }> {
  const serializedBody = JSON.stringify(input.body);
  const idempotencyKey = input.idempotencyKey ?? createIdempotencyKey(serializedBody);
  return withProviderRetries({
    provider: 'pika',
    model: input.metadata.apiId,
    context: input.context,
    maxAttempts: 3,
    operation: async () => {
      let response: Response;
      try {
        response = await pikaFetch(input.context, input.metadata.apiId)(
          `${PIKA_ORIGIN}${input.metadata.path}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              'X-API-Key': input.context.credential,
            },
            body: serializedBody,
            redirect: 'error',
            signal: input.context.signal,
          },
        );
      } catch (error) {
        throw new EngineError(
          input.context.signal.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_SUBMIT_FAILED',
          'Pika media submission could not be completed.',
          {
            provider: 'pika',
            model: input.metadata.apiId,
            retryable: !input.context.signal.aborted,
            cause: error,
          },
        );
      }
      const body = await readPikaResponseBody(response);
      if (!response.ok) {
        if (isFailedJobEnvelope(body)) {
          return {
            job: parsePikaJob(body, {
              model: input.metadata.apiId,
              fallbackCode: 'ENGINE_SUBMIT_FAILED',
            }),
            ...(readRetryAfter(response) === undefined
              ? {}
              : { retryAfterMs: readRetryAfter(response) }),
          };
        }
        throw pikaHttpError({
          response,
          model: input.metadata.apiId,
          fallbackCode: 'ENGINE_SUBMIT_FAILED',
          operation: 'submit',
        });
      }
      return {
        job: parsePikaJob(body, {
          model: input.metadata.apiId,
          fallbackCode: 'ENGINE_SUBMIT_FAILED',
        }),
      };
    },
    classify: retryDecision,
  });
}

export async function resolvePikaJob(input: {
  metadata: PikaOperationMetadata;
  requestId: string;
  context: ProviderExecutionContext;
  initialJob?: PikaJob;
  recovery: boolean;
}): Promise<{
  requestId: string;
  artifacts: GeneratedMediaArtifact[];
  receipt: JsonValue;
}> {
  if (!input.requestId) {
    throw new EngineError(
      'ENGINE_RECOVERY_FAILED',
      'Pika recovery requires a non-empty media job id.',
      { provider: 'pika', model: input.metadata.apiId },
    );
  }
  const completed = input.initialJob?.status === 'completed' || input.initialJob?.status === 'failed'
    ? input.initialJob
    : await pollPikaJob(input);
  if (completed.status === 'failed') {
    throw pikaJobFailure(completed, input.metadata.apiId);
  }
  const contentUrl = await readContentUrl(input);
  let artifacts: GeneratedMediaArtifact[];
  try {
    artifacts = await downloadProviderOutputs({
      provider: 'pika',
      model: input.metadata.apiId,
      requestId: input.requestId,
      urls: [contentUrl],
      context: input.context,
    });
  } catch (error) {
    if (error instanceof EngineError) {
      throw new EngineError(
        error.code,
        error.message,
        {
          provider: 'pika',
          model: input.metadata.apiId,
          requestId: input.requestId,
          httpStatus: error.httpStatus,
          retryable: error.retryable,
          retryAfterMs: error.retryAfterMs,
        },
      );
    }
    throw error;
  }
  await assertOutputCategory(artifacts, input.metadata.category, input.metadata.apiId, input.requestId);
  return {
    requestId: input.requestId,
    artifacts,
    receipt: {
      requestId: input.requestId,
      status: 'completed',
      mediaType: input.metadata.category,
    },
  };
}

async function pollPikaJob(input: {
  metadata: PikaOperationMetadata;
  requestId: string;
  context: ProviderExecutionContext;
  recovery: boolean;
}): Promise<PikaJob> {
  return pollProviderJob({
    provider: 'pika',
    model: input.metadata.apiId,
    requestId: input.requestId,
    context: input.context,
    intervalMs: 2_000,
    poll: async () => {
      let response: Response;
      try {
        response = await pikaFetch(input.context, input.metadata.apiId, input.requestId)(
          `${PIKA_ORIGIN}/v1/media/jobs/${encodeURIComponent(input.requestId)}`,
          {
            headers: { 'X-API-Key': input.context.credential },
            redirect: 'error',
            signal: input.context.signal,
          },
        );
      } catch (error) {
        throw new EngineError(
          input.context.signal.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_POLL_FAILED',
          'Pika media job status could not be read.',
          {
            provider: 'pika',
            model: input.metadata.apiId,
            requestId: input.requestId,
            retryable: !input.context.signal.aborted,
            cause: error,
          },
        );
      }
      if (!response.ok) {
        throw pikaHttpError({
          response,
          model: input.metadata.apiId,
          fallbackCode: input.recovery ? 'ENGINE_RECOVERY_FAILED' : 'ENGINE_POLL_FAILED',
          operation: input.recovery ? 'recover' : 'poll',
          requestId: input.requestId,
        });
      }
      return parsePikaJob(await readPikaResponseBody(response), {
        model: input.metadata.apiId,
        fallbackCode: input.recovery ? 'ENGINE_RECOVERY_FAILED' : 'ENGINE_POLL_FAILED',
        requestId: input.requestId,
      });
    },
    pollRetry: { maxAttempts: 3, classify: retryDecision },
    classify: (job) => job.status === 'queued' || job.status === 'running'
      ? 'pending'
      : 'completed',
    failureMessage: () => 'Pika media job failed.',
  });
}

async function readContentUrl(input: {
  metadata: PikaOperationMetadata;
  requestId: string;
  context: ProviderExecutionContext;
  recovery: boolean;
}): Promise<string> {
  let response: Response;
  try {
    response = await withProviderRetries({
      provider: 'pika',
      model: input.metadata.apiId,
      context: input.context,
      maxAttempts: 3,
      operation: async () => {
        const result = await pikaFetch(input.context, input.metadata.apiId, input.requestId)(
          `${PIKA_ORIGIN}/v1/media/jobs/${encodeURIComponent(input.requestId)}/content`,
          {
            headers: { 'X-API-Key': input.context.credential },
            redirect: 'error',
            signal: input.context.signal,
          },
        );
        if (!result.ok) {
          throw pikaHttpError({
            response: result,
            model: input.metadata.apiId,
            fallbackCode: input.recovery ? 'ENGINE_RECOVERY_FAILED' : 'ENGINE_OUTPUT_INVALID',
            operation: 'content',
            requestId: input.requestId,
          });
        }
        return result;
      },
      classify: retryDecision,
    });
  } catch (error) {
    if (error instanceof EngineError) {
      throw error;
    }
    throw new EngineError(
      input.recovery ? 'ENGINE_RECOVERY_FAILED' : 'ENGINE_OUTPUT_INVALID',
      'Pika media content could not be resolved.',
      {
        provider: 'pika',
        model: input.metadata.apiId,
        requestId: input.requestId,
        cause: error,
      },
    );
  }
  const body = await readPikaResponseBody(response);
  const url = isRecord(body) ? body.url : undefined;
  if (typeof url !== 'string' || !isHttpsUrl(url)) {
    throw new EngineError(
      'ENGINE_OUTPUT_INVALID',
      'Pika returned an invalid media content response.',
      { provider: 'pika', model: input.metadata.apiId, requestId: input.requestId },
    );
  }
  return url;
}

async function assertOutputCategory(
  artifacts: GeneratedMediaArtifact[],
  category: PikaMediaCategory,
  model: string,
  requestId: string,
): Promise<void> {
  const invalid = artifacts.find(
    (artifact) => artifact.byteLength <= 0 || !artifact.mimeType.startsWith(`${category}/`),
  );
  if (!invalid) {
    return;
  }
  await Promise.all(artifacts.map((artifact) => unlink(artifact.path).catch(() => undefined)));
  throw new EngineError(
    'ENGINE_OUTPUT_INVALID',
    `Pika returned media that does not match the catalog ${category} category.`,
    { provider: 'pika', model, requestId },
  );
}

function createIdempotencyKey(serializedBody: string): string {
  const bodyHash = createHash('sha256').update(serializedBody).digest('hex').slice(0, 20);
  return `renku-${bodyHash}-${randomUUID()}`;
}

function retryDecision(error: unknown): { retryable: boolean; retryAfterMs?: number } {
  return error instanceof EngineError
    ? { retryable: error.retryable, retryAfterMs: error.retryAfterMs }
    : { retryable: false };
}

function pikaFetch(
  context: ProviderExecutionContext,
  model: string,
  requestId?: string,
): typeof fetch {
  return createRequestTimeoutFetch({ provider: 'pika', model, requestId, context });
}

function isFailedJobEnvelope(value: JsonValue | undefined): boolean {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.status === 'failed';
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
