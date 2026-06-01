import type { ShotCameraDesign } from '@gorenku/studio-core/server';
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

const CONTEXT = 'scene shot camera design request';

/**
 * Parse the PATCH shot camera-design body. The controlled-vocabulary ids are
 * validated downstream by the core shot-list schema when the document is
 * re-serialized, so this parser only checks the envelope shape and returns the
 * raw `cameraDesign` (object) or `null` to clear it.
 */
export function readSceneShotCameraDesignRequest(
  input: unknown
): ShotCameraDesign | null {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['cameraDesign'],
    issues,
    CONTEXT,
    'Send only the cameraDesign field.'
  );

  const value = record.cameraDesign;
  if (value === null || value === undefined) {
    finishOrThrow(issues);
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER330',
        'cameraDesign must be an object or null.',
        { path: ['cameraDesign'], context: CONTEXT },
        'Send the structured camera design object, or null to clear it.'
      )
    );
    throwRequestError(issues);
  }
  finishOrThrow(issues);
  return value as ShotCameraDesign;
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
    message: 'Scene shot camera design request failed validation.',
    issues,
    suggestion: 'Send a cameraDesign object or null.',
  });
}
