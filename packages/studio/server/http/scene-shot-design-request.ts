import type { SceneShotVideoTakeShotDesign } from '@gorenku/studio-core/server';
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

const CONTEXT = 'scene shot design request';

export function readSceneShotDesignRequest(
  input: unknown
): SceneShotVideoTakeShotDesign | null {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['shotDesign'],
    issues,
    CONTEXT,
    'Send only the shotDesign field.'
  );

  const value = record.shotDesign;
  if (value === null || value === undefined) {
    finishOrThrow(issues);
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER330',
        'shotDesign must be an object or null.',
        { path: ['shotDesign'], context: CONTEXT },
        'Send the structured shot design object, or null to clear it.'
      )
    );
    throwRequestError(issues);
  }
  finishOrThrow(issues);
  return value as SceneShotVideoTakeShotDesign;
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
    message: 'Scene shot design request failed validation.',
    issues,
    suggestion: 'Send a shotDesign object or null.',
  });
}
