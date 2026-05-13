import {
  StructuredError,
  createDiagnosticError,
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';

export class StudioCoordinationError extends StructuredError {
  constructor(
    code: string,
    message: string,
    options: {
      issues?: DiagnosticIssue[];
      suggestion?: string;
    } = {}
  ) {
    super({
      code,
      message,
      issues: options.issues,
      suggestion: options.suggestion,
    });
    this.name = 'StudioCoordinationError';
  }
}

export function studioCoordinationError(
  code: string,
  message: string,
  path: string[],
  suggestion?: string
): StudioCoordinationError {
  return new StudioCoordinationError(code, message, {
    issues: [
      createDiagnosticError(
        code,
        message,
        { path, context: 'studio coordination' },
        suggestion
      ),
    ],
    suggestion,
  });
}

export function studioCoordinationWarning(
  code: string,
  message: string,
  path: string[],
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticWarning(
    code,
    message,
    { path, context: 'studio coordination' },
    suggestion
  );
}
