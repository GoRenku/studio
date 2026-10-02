import { isStructuredError, StructuredError } from '@gorenku/studio-diagnostics';

export function reviewError(code: string, message: string, suggestion?: string): StructuredError {
  return new StructuredError({ code, message, suggestion });
}

export function integrationErrorResult(error: unknown) {
  const failure = isStructuredError(error)
    ? error
    : reviewError('CODEX_REVIEW_INVALID', 'The local Codex integration failed.', 'Check the local runtime diagnostics.');
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `[${failure.code}] ${failure.message}` }],
    structuredContent: {
      error: { code: failure.code, message: failure.message, suggestion: failure.suggestion },
      issues: failure.issues,
    },
  };
}
