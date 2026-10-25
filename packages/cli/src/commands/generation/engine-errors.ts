import { resolveRenkuStateDir } from '@gorenku/studio-core/server';
import { isEngineError, type EngineError } from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';

export function throwEngineError(error: unknown): never {
  if (!isEngineError(error)) {
    throw error;
  }
  throw new StructuredError({
    code: error.code,
    message: error.message,
    suggestion: engineErrorSuggestion(error),
  });
}

/** What the user can do about an Engines error, when there is something to do. */
export function engineErrorSuggestion(error: EngineError): string | undefined {
  if (error.code === 'ENGINE_METADATA_CACHE_UNWRITABLE') {
    const stateDir = resolveRenkuStateDir();
    return `Renku needs write access to its state folder ${stateDir}. In a Codex permission profile, add "${stateDir}" = "write" under [permissions.<profile>.filesystem] in ~/.codex/config.toml, then start a new Codex thread.`;
  }
  if (!error.retryable) {
    return undefined;
  }
  return error.requestId
    ? `Retry recovery with provider request id ${error.requestId}.`
    : 'Retry after the provider becomes available.';
}
