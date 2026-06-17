import type {
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
  readOptionalHttpString,
  readRequiredHttpString,
} from './request-validation.js';

const SELECT_CONTEXT = 'scene shot video take input select request';
const CLEAR_CONTEXT = 'scene shot video take input clear request';
const DELETE_CONTEXT = 'scene shot video take input delete request';

export interface ShotVideoTakeInputSelectRequest {
  inputId: string;
}

export interface ShotVideoTakeInputClearRequest {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export type ShotVideoTakeInputDeleteRequest = Record<string, never>;

/**
 * Parse the reusable-input select body (0041). Subject-kind and subject-id
 * ownership rules are delegated to core (0040).
 */
export function readShotVideoTakeInputSelectRequest(
  input: unknown
): ShotVideoTakeInputSelectRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, SELECT_CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['inputId'],
    issues,
    SELECT_CONTEXT,
    'Send only the inputId field.'
  );

  const inputId = readRequiredHttpString(record, ['inputId'], issues, SELECT_CONTEXT);

  finishOrThrow(issues);
  return { inputId: inputId ?? '' };
}

/**
 * Parse the reusable-input clear/regenerate body (0041). The `kind` is
 * required; subject-kind and subject-id requirements are delegated to core.
 */
export function readShotVideoTakeInputClearRequest(
  input: unknown
): ShotVideoTakeInputClearRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CLEAR_CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['kind', 'subjectKind', 'subjectId'],
    issues,
    CLEAR_CONTEXT,
    'Send only the kind, subjectKind, and subjectId fields.'
  );

  const kind = readRequiredHttpString(record, ['kind'], issues, CLEAR_CONTEXT);
  const subjectKind = readOptionalHttpString(
    record,
    ['subjectKind'],
    issues,
    CLEAR_CONTEXT
  );
  const subjectId = readOptionalHttpString(record, ['subjectId'], issues, CLEAR_CONTEXT);

  finishOrThrow(issues);
  return {
    kind: (kind ?? '') as ShotVideoTakeInputKind,
    ...(subjectKind
      ? { subjectKind: subjectKind as ShotVideoTakeInputSubjectKind }
      : {}),
    ...(subjectId ? { subjectId } : {}),
  };
}

export function readShotVideoTakeInputDeleteRequest(
  input: unknown
): ShotVideoTakeInputDeleteRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, DELETE_CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    [],
    issues,
    DELETE_CONTEXT,
    'Send an empty object.'
  );

  finishOrThrow(issues);
  return {};
}

function finishOrThrow(issues: DiagnosticIssue[]): void {
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwRequestError(result.issues);
  }
}

function throwRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER343',
    message: 'Shot video take input request failed validation.',
    issues,
    suggestion: 'Send a select or clear request with the documented fields.',
  });
}
