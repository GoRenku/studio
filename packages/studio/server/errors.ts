import { isStructuredError } from '@gorenku/studio-diagnostics';
import type { Context } from 'hono';

export function projectErrorResponse(c: Context, error: unknown): Response {
  if (isStructuredError(error)) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          issues: error.issues,
          suggestion: error.suggestion,
        },
      },
      statusForStructuredError(error.code)
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return c.json(
    {
      error: {
        code: 'STUDIO_SERVER000',
        message,
      },
    },
    500
  );
}

function statusForStructuredError(code: string): 400 | 404 | 500 {
  if (
    code === 'PROJECT_DATA020' ||
    code === 'PROJECT_DATA040' ||
    code === 'PROJECT_DATA041'
  ) {
    return 404;
  }
  if (
    code.startsWith('CONFIG') ||
    code.startsWith('PROJECT_DATA') ||
    code.startsWith('PROJECT_SETUP')
  ) {
    return 400;
  }
  return 500;
}
