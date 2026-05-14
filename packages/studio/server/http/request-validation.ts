import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';

export function readHttpRequestRecord(
  input: unknown,
  path: string[],
  issues: DiagnosticIssue[],
  context: string
): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatHttpRequestPath(path)} must be an object.`,
        { path, context }
      )
    );
    return null;
  }
  return input as Record<string, unknown>;
}

export function assertHttpRequestFields(
  record: Record<string, unknown>,
  path: string[],
  allowedKeys: string[],
  issues: DiagnosticIssue[],
  context: string,
  suggestion: string
): void {
  const allowed = new Set(allowedKeys);
  Object.keys(record).forEach((key) => {
    if (allowed.has(key)) {
      return;
    }
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER012',
        `Unknown field ${formatHttpRequestPath([...path, key])} is not supported.`,
        { path: [...path, key], context },
        suggestion
      )
    );
  });
}

export function readRequiredHttpString(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[],
  context: string
): string | null {
  const value = record[path[path.length - 1]];
  if (typeof value !== 'string') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatHttpRequestPath(path)} must be a string.`,
        { path, context }
      )
    );
    return null;
  }
  return value;
}

export function readOptionalHttpString(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[],
  context: string
): string | undefined {
  const value = record[path[path.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatHttpRequestPath(path)} must be a string.`,
        { path, context }
      )
    );
    return undefined;
  }
  return value;
}

export function readRequiredHttpBoolean(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[],
  context: string
): boolean | null {
  const value = record[path[path.length - 1]];
  if (typeof value !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatHttpRequestPath(path)} must be a boolean.`,
        { path, context }
      )
    );
    return null;
  }
  return value;
}

export function formatHttpRequestPath(path: string[]): string {
  if (path.length === 0) {
    return '<root>';
  }
  return path.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }
    return label ? `${label}.${segment}` : segment;
  }, '');
}
