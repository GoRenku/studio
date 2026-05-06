export type DiagnosticSeverity = 'error' | 'warning';

export interface DiagnosticLocation {
  filePath?: string;
  path: string[];
  context?: string;
}

export interface DiagnosticIssue {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  location: DiagnosticLocation;
  suggestion?: string;
}

export interface DiagnosticResult {
  valid: boolean;
  issues: DiagnosticIssue[];
  errors: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
}

export interface StructuredErrorOptions {
  code: string;
  message: string;
  issues?: DiagnosticIssue[];
  suggestion?: string;
}

export class StructuredError extends Error {
  public readonly code: string;
  public readonly issues: DiagnosticIssue[];
  public readonly suggestion?: string;

  constructor(options: StructuredErrorOptions) {
    super(options.message);
    this.name = 'StructuredError';
    this.code = options.code;
    this.issues = options.issues ?? [];
    this.suggestion = options.suggestion;
  }
}

export function createDiagnosticIssue(
  code: string,
  message: string,
  severity: DiagnosticSeverity,
  location: DiagnosticLocation,
  suggestion?: string
): DiagnosticIssue {
  return {
    code,
    message,
    severity,
    location,
    suggestion,
  };
}

export function createDiagnosticError(
  code: string,
  message: string,
  location: DiagnosticLocation,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticIssue(code, message, 'error', location, suggestion);
}

export function createDiagnosticWarning(
  code: string,
  message: string,
  location: DiagnosticLocation,
  suggestion?: string
): DiagnosticIssue {
  return createDiagnosticIssue(code, message, 'warning', location, suggestion);
}

export function buildDiagnosticResult(
  issues: DiagnosticIssue[]
): DiagnosticResult {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

export function createStructuredError(
  options: StructuredErrorOptions
): StructuredError {
  return new StructuredError(options);
}

export function isStructuredError(error: unknown): error is StructuredError {
  return error instanceof StructuredError;
}

export function throwIfDiagnosticResultInvalid(
  result: DiagnosticResult,
  options: {
    code: string;
    message: string;
    suggestion?: string;
  }
): void {
  if (result.valid) {
    return;
  }

  throw new StructuredError({
    code: options.code,
    message: options.message,
    issues: result.issues,
    suggestion: options.suggestion,
  });
}
