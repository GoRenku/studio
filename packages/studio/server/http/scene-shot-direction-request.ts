import type { SceneShotVideoTakeDirection } from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
} from './request-validation.js';

const CONTEXT = 'scene shot video take direction request';

export function readSceneShotVideoTakeDirectionRequest(
  input: unknown
): SceneShotVideoTakeDirection | null {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['direction'],
    issues,
    CONTEXT,
    'Send only the direction field.'
  );

  const value = record.direction;
  if (value === null || value === undefined) {
    finishOrThrow(issues);
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER330',
        'direction must be an object or null.',
        { path: ['direction'], context: CONTEXT },
        'Send the structured direction object, or null to clear it.'
      )
    );
    throwRequestError(issues);
  }
  finishOrThrow(issues);
  return value as SceneShotVideoTakeDirection;
}

function finishOrThrow(issues: DiagnosticIssue[]): void {
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwRequestError(result.issues);
  }
}

function throwRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER331',
    message: 'Scene shot video take direction request failed validation.',
    issues,
    suggestion: 'Send a direction object or null.',
  });
}
