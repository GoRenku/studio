interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export class StudioApiError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(
    message: string,
    code: string | undefined,
    status: number
  ) {
    super(message);
    this.name = 'StudioApiError';
    this.code = code;
    this.status = status;
  }
}

export async function readStudioApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ErrorResponse;
    const code = body.error?.code;
    const message = body.error?.message ?? response.statusText;
    return new StudioApiError(
      code ? `${code}: ${message}` : message,
      code,
      response.status
    );
  } catch {
    return new StudioApiError(response.statusText, undefined, response.status);
  }
}

export function isStudioApiErrorCode(
  error: unknown,
  code: string
): boolean {
  return error instanceof StudioApiError && error.code === code;
}
