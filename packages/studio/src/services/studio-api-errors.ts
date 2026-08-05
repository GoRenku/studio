import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
    issues?: DiagnosticIssue[];
    suggestion?: string;
  };
}

export class StudioApiError extends Error {
  readonly code: string | undefined;
  readonly status: number;
  readonly issues: DiagnosticIssue[];
  readonly suggestion: string | undefined;
  readonly summary: string;

  constructor(
    summary: string,
    code: string | undefined,
    status: number,
    issues: DiagnosticIssue[] = [],
    suggestion?: string
  ) {
    const actionableIssue = issues.find((issue) => issue.severity === 'error');
    super(actionableIssue?.message ?? summary);
    this.name = 'StudioApiError';
    this.code = code;
    this.status = status;
    this.issues = issues;
    this.suggestion = suggestion;
    this.summary = summary;
  }
}

export async function readStudioApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ErrorResponse;
    const code = body.error?.code;
    const summary = body.error?.message ?? response.statusText;
    return new StudioApiError(
      summary,
      code,
      response.status,
      body.error?.issues,
      body.error?.suggestion
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
