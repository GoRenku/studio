import { StructuredError, createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';

const DISABLE_SUGGESTION =
  'Run `renku telemetry disable` to remove it, or turn usage statistics off in Settings.';

export class TelemetryError extends StructuredError {
  constructor(
    code: string,
    message: string,
    options: { issues?: DiagnosticIssue[]; suggestion?: string } = {}
  ) {
    super({ code, message, issues: options.issues, suggestion: options.suggestion });
    this.name = 'TelemetryError';
  }
}

export function telemetryChoiceInvalidError(issues: DiagnosticIssue[]): TelemetryError {
  return new TelemetryError('CORE_TELEMETRY_CHOICE_INVALID', 'The usage statistics choice is invalid.', { issues });
}

export function telemetryChoiceIssue(field: string, message: string): DiagnosticIssue {
  return createDiagnosticError('CORE_TELEMETRY_CHOICE_INVALID', message, {
    path: [field],
    context: 'Usage statistics choice',
  });
}

export function telemetryFileInvalidError(filePath: string): TelemetryError {
  return new TelemetryError(
    'CORE_TELEMETRY_FILE_INVALID',
    `The usage statistics file is not valid: ${filePath}`,
    { suggestion: DISABLE_SUGGESTION }
  );
}

export function telemetryFileIoError(operation: 'read' | 'write' | 'delete', filePath: string): TelemetryError {
  return new TelemetryError(
    'CORE_TELEMETRY_FILE_IO_FAILED',
    `Renku could not ${operation} the usage statistics file: ${filePath}`,
    { suggestion: 'Check that the Renku configuration folder is writable, then try again.' }
  );
}
