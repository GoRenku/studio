import type { ProviderContext } from '../media/contracts.js';
import { EngineError } from './errors.js';

export interface RetryDecision {
  retryable: boolean;
  retryAfterMs?: number;
}

export async function withProviderRetries<T>(input: {
  provider: string;
  model: string;
  context: ProviderContext;
  maxAttempts: number;
  operation: () => Promise<T>;
  classify: (error: unknown) => RetryDecision;
}): Promise<T> {
  const startedAt = (input.context.clock ?? (() => new Date()))().getTime();
  let lastError: unknown;
  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    if (input.context.signal.aborted) {
      throw new EngineError('ENGINE_CANCELLED', 'Media generation was cancelled.', {
        provider: input.provider,
        model: input.model,
        cause: input.context.signal.reason,
      });
    }
    try {
      return await input.operation();
    } catch (error) {
      lastError = error;
      const decision = input.classify(error);
      if (!decision.retryable || attempt === input.maxAttempts) {
        throw error;
      }
      const now = (input.context.clock ?? (() => new Date()))().getTime();
      const remaining = input.context.operationTimeoutMs - (now - startedAt);
      const delay = Math.min(
        decision.retryAfterMs ?? exponentialDelay(attempt, input.context.random?.() ?? Math.random()),
        remaining,
      );
      if (delay <= 0) {
        throw new EngineError(
          'ENGINE_OPERATION_TIMEOUT',
          `Media generation for ${input.provider}/${input.model} exceeded its deadline.`,
          { provider: input.provider, model: input.model, retryable: true, cause: lastError },
        );
      }
      await (input.context.sleep ?? sleep)(delay, input.context.signal);
    }
  }
  throw lastError;
}

function exponentialDelay(attempt: number, random: number): number {
  const base = Math.min(1_000 * 2 ** (attempt - 1), 30_000);
  return Math.round(base * (0.75 + random * 0.5));
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
