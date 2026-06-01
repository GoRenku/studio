import type { ShotSpecs } from '@gorenku/studio-core/server';
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

const CONTEXT = 'scene shot specs request';

/**
 * Parse the PATCH shot specs body. The controlled-vocabulary ids are
 * validated downstream by the core shot-list schema when the document is
 * re-serialized, so this parser only checks the envelope shape and returns the
 * raw `shotSpecs` (object) or `null` to clear it.
 */
export function readSceneShotSpecsRequest(
  input: unknown
): ShotSpecs | null {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['shotSpecs'],
    issues,
    CONTEXT,
    'Send only the shotSpecs field.'
  );

  const value = record.shotSpecs;
  if (value === null || value === undefined) {
    finishOrThrow(issues);
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER330',
        'shotSpecs must be an object or null.',
        { path: ['shotSpecs'], context: CONTEXT },
        'Send the structured shot specs object, or null to clear it.'
      )
    );
    throwRequestError(issues);
  }
  finishOrThrow(issues);
  return value as ShotSpecs;
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
    message: 'Scene shot specs request failed validation.',
    issues,
    suggestion: 'Send a shotSpecs object or null.',
  });
}
