import type { ProviderContext } from '../media/contracts.js';
import { EngineError } from './errors.js';
import { withProviderRetries, type RetryDecision } from './retry.js';

export async function pollProviderJob<T>(input: {
  provider: string;
  model: string;
  requestId: string;
  context: ProviderContext;
  intervalMs: number;
  poll: () => Promise<T>;
  pollRetry?: {
    maxAttempts: number;
    classify: (error: unknown) => RetryDecision;
  };
  classify: (value: T) => 'pending' | 'completed' | 'failed';
  failureMessage: (value: T) => string;
}): Promise<T> {
  const startedAt = (input.context.clock ?? (() => new Date()))().getTime();
  for (;;) {
    if (input.context.signal.aborted) {
      throw new EngineError('ENGINE_CANCELLED', 'Media generation was cancelled.', {
        provider: input.provider,
        model: input.model,
        requestId: input.requestId,
        cause: input.context.signal.reason,
      });
    }
    const result = input.pollRetry
      ? await withProviderRetries({
          provider: input.provider,
          model: input.model,
          context: input.context,
          maxAttempts: input.pollRetry.maxAttempts,
          operation: input.poll,
          classify: input.pollRetry.classify,
        })
      : await input.poll();
    const status = input.classify(result);
    if (status === 'completed') {
      return result;
    }
    if (status === 'failed') {
      throw new EngineError('ENGINE_JOB_FAILED', input.failureMessage(result), {
        provider: input.provider,
        model: input.model,
        requestId: input.requestId,
      });
    }
    const elapsed = (input.context.clock ?? (() => new Date()))().getTime() - startedAt;
    if (elapsed >= input.context.operationTimeoutMs) {
      throw new EngineError(
        'ENGINE_OPERATION_TIMEOUT',
        `Provider job ${input.requestId} exceeded its polling deadline.`,
        {
          provider: input.provider,
          model: input.model,
          requestId: input.requestId,
          retryable: true,
        },
      );
    }
    await (input.context.sleep ?? sleep)(input.intervalMs, input.context.signal);
  }
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
