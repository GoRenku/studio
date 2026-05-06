import { ProjectDataError } from '@gorenku/studio-core';
import type { Context } from 'hono';

export function projectErrorResponse(c: Context, error: unknown): Response {
  if (error instanceof ProjectDataError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      statusForProjectError(error.code)
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return c.json(
    {
      error: {
        code: 'S000',
        message,
      },
    },
    500
  );
}

function statusForProjectError(code: string): 400 | 404 | 500 {
  if (code === 'P020' || code === 'P030' || code === 'P031') {
    return 404;
  }
  if (code.startsWith('C') || code.startsWith('P')) {
    return 400;
  }
  return 500;
}
