import type { ProviderContext } from '../media/contracts.js';
import { EngineError } from './errors.js';

export function createRequestTimeoutFetch(input: {
  provider: string;
  model: string;
  context: Pick<ProviderContext, 'fetch' | 'signal' | 'requestTimeoutMs'>;
  requestId?: string;
}): typeof fetch {
  return async (resource, init) => {
    const timeoutSignal = AbortSignal.timeout(Math.max(1, input.context.requestTimeoutMs));
    const signals = [input.context.signal, timeoutSignal];
    if (init?.signal) {
      signals.push(init.signal);
    }
    try {
      return await input.context.fetch(resource, {
        ...init,
        signal: AbortSignal.any(signals),
      });
    } catch (error) {
      if (input.context.signal.aborted) {
        throw new EngineError('ENGINE_CANCELLED', 'Media generation was cancelled.', {
          provider: input.provider,
          model: input.model,
          requestId: input.requestId,
          cause: input.context.signal.reason ?? error,
        });
      }
      if (timeoutSignal.aborted) {
        throw new EngineError('ENGINE_PROVIDER_UNAVAILABLE', 'Provider request timed out.', {
          provider: input.provider,
          model: input.model,
          requestId: input.requestId,
          retryable: true,
          cause: error,
        });
      }
      throw error;
    }
  };
}
