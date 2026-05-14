import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';

export function readPageRequest(query: Record<string, string | undefined>): {
  limit?: number;
  cursor?: string;
} {
  return {
    limit: query.limit === undefined ? undefined : readLimitQuery(query.limit),
    cursor: readOptionalQueryString(query.cursor),
  };
}

export function readOptionalQueryString(
  value: string | undefined
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readLimitQuery(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw createStructuredError({
      code: 'STUDIO_SERVER030',
      message: 'Page limit must be an integer.',
      issues: [
        createDiagnosticError(
          'STUDIO_SERVER030',
          'Page limit must be an integer.',
          { path: ['limit'] },
          'Send limit as a whole number.'
        ),
      ],
      suggestion: 'Send limit as a whole number.',
    });
  }
  return parsed;
}
