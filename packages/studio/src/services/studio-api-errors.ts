interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function readStudioApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ErrorResponse;
    const code = body.error?.code;
    const message = body.error?.message ?? response.statusText;
    return new Error(code ? `${code}: ${message}` : message);
  } catch {
    return new Error(response.statusText);
  }
}

