import { isEngineError } from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';

export function throwEngineError(error: unknown): never {
  if (!isEngineError(error)) {
    throw error;
  }
  throw new StructuredError({
    code: error.code,
    message: error.message,
    suggestion: error.retryable
      ? error.requestId
        ? `Retry recovery with provider request id ${error.requestId}.`
        : 'Retry after the provider becomes available.'
      : undefined,
  });
}
