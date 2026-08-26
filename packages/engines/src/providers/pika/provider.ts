import type {
  JsonValue,
  MediaProvider,
  ProviderContext,
  ProviderExecutionContext,
  ProviderExecutionResult,
  ProviderRequest,
} from '../../media/contracts.js';
import { replaceLocalMediaFilesWithValidationUrls } from '../../media/local-files.js';
import { EngineError } from '../../shared/errors.js';
import { validateJsonSchema } from '../../shared/json-schema-validation.js';
import { pikaJobFailure, PikaTerminalJobError } from './errors.js';
import { resolvePikaJob, submitPikaJob } from './jobs.js';
import {
  loadPikaOperationMetadata,
  type PikaOperationMetadata,
} from './metadata.js';
import { preflightPikaLocalMedia, uploadPikaLocalMedia } from './uploads.js';

export function createPikaMediaProvider(): MediaProvider {
  return {
    id: 'pika',
    async readInputSchema(model, context) {
      requireCredential(model, context);
      return (await loadPikaOperationMetadata(model, context)).inputSchema;
    },
    async validate(request, context) {
      requireCredential(request.model, context);
      await validatePikaRequest(request, context);
    },
    async execute(request, context) {
      requireCredential(request.model, context);
      const prepared = await validatePikaRequest(request, context);
      const uploadedInput = await uploadPikaLocalMedia({
        request,
        context,
        preflight: prepared.preflight,
      });
      validateJsonSchema({
        provider: 'pika',
        model: request.model,
        schema: prepared.metadata.inputSchema,
        value: uploadedInput,
      });
      return executePikaRequest(prepared.metadata, uploadedInput, context);
    },
    async recover(request, context) {
      requireCredential(request.model, context);
      const metadata = await loadPikaOperationMetadata(request.model, context);
      const result = await resolvePikaJob({
        metadata,
        requestId: request.requestId,
        context,
        recovery: true,
      });
      return executionResult(metadata, result);
    },
  };
}

async function validatePikaRequest(
  request: ProviderRequest,
  context: ProviderContext,
) {
  const metadata = await loadPikaOperationMetadata(request.model, context);
  const preflight = await preflightPikaLocalMedia({
    request,
    schema: metadata.inputSchema,
  });
  validateJsonSchema({
    provider: 'pika',
    model: request.model,
    schema: metadata.inputSchema,
    value: replaceLocalMediaFilesWithValidationUrls(request.input),
  });
  return { metadata, preflight };
}

async function executePikaRequest(
  metadata: PikaOperationMetadata,
  body: JsonValue,
  context: ProviderExecutionContext,
): Promise<ProviderExecutionResult> {
  const startedAt = now(context);
  let terminalRetryUsed = false;
  for (;;) {
    const submitted = await submitPikaJob({
      metadata,
      body,
      context: contextWithinDeadline(context, startedAt, metadata.apiId),
    });
    try {
      if (submitted.job.status === 'failed') {
        throw pikaJobFailure(submitted.job, metadata.apiId, submitted.retryAfterMs);
      }
      const result = await resolvePikaJob({
        metadata,
        requestId: submitted.job.id,
        context: contextWithinDeadline(
          context,
          startedAt,
          metadata.apiId,
          submitted.job.id,
        ),
        initialJob: submitted.job,
        recovery: false,
      });
      return executionResult(metadata, result);
    } catch (error) {
      if (!terminalRetryUsed && isRetryableTerminalJobError(error)) {
        terminalRetryUsed = true;
        await waitForTerminalRetry(error, context, startedAt);
        continue;
      }
      throw error;
    }
  }
}

function executionResult(
  metadata: PikaOperationMetadata,
  result: Awaited<ReturnType<typeof resolvePikaJob>>,
): ProviderExecutionResult {
  return {
    provider: 'pika',
    model: metadata.apiId,
    requestId: result.requestId,
    artifacts: result.artifacts,
    receipt: result.receipt,
  };
}

function isRetryableTerminalJobError(error: unknown): error is PikaTerminalJobError {
  return error instanceof PikaTerminalJobError
    && (error.code === 'ENGINE_RATE_LIMITED' || error.code === 'ENGINE_PROVIDER_UNAVAILABLE');
}

async function waitForTerminalRetry(
  error: PikaTerminalJobError,
  context: ProviderExecutionContext,
  startedAt: number,
): Promise<void> {
  const remaining = remainingTime(context, startedAt);
  const delay = error.retryAfterMs ?? 1_000;
  if (remaining <= 0 || delay >= remaining) {
    throw operationTimeout(error.model, error.requestId, error);
  }
  await (context.sleep ?? sleep)(delay, context.signal);
}

function contextWithinDeadline(
  context: ProviderExecutionContext,
  startedAt: number,
  model: string,
  requestId?: string,
): ProviderExecutionContext {
  const remaining = remainingTime(context, startedAt);
  if (remaining <= 0) {
    throw operationTimeout(model, requestId);
  }
  return {
    ...context,
    operationTimeoutMs: remaining,
    requestTimeoutMs: Math.min(context.requestTimeoutMs, remaining),
  };
}

function remainingTime(context: ProviderExecutionContext, startedAt: number): number {
  return context.operationTimeoutMs - (now(context) - startedAt);
}

function now(context: ProviderExecutionContext): number {
  return (context.clock ?? (() => new Date()))().getTime();
}

function operationTimeout(
  model: string | undefined,
  requestId?: string,
  cause?: unknown,
): EngineError {
  return new EngineError(
    'ENGINE_OPERATION_TIMEOUT',
    'Pika media generation exceeded its operation deadline.',
    { provider: 'pika', model, requestId, retryable: true, cause },
  );
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function requireCredential(model: string, context: ProviderContext): void {
  if (!context.credential) {
    throw new EngineError(
      'ENGINE_AUTHENTICATION_FAILED',
      'Pika credential is required.',
      { provider: 'pika', model },
    );
  }
}
