import type {
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createDiagnosticError,
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
  shotIds: string[];
  inputId: string;
}

export interface ShotVideoTakeInputClearRequest {
  shotIds: string[];
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ShotVideoTakeInputDeleteRequest {
  shotIds: string[];
}

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
    ['shotIds', 'inputId'],
    issues,
    SELECT_CONTEXT,
    'Send only the shotIds and inputId fields.'
  );

  const shotIds = readShotIds(record, issues, SELECT_CONTEXT);
  const inputId = readRequiredHttpString(record, ['inputId'], issues, SELECT_CONTEXT);

  finishOrThrow(issues);
  return { shotIds: shotIds ?? [], inputId: inputId ?? '' };
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
    ['shotIds', 'kind', 'subjectKind', 'subjectId'],
    issues,
    CLEAR_CONTEXT,
    'Send only the shotIds, kind, subjectKind, and subjectId fields.'
  );

  const shotIds = readShotIds(record, issues, CLEAR_CONTEXT);
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
    shotIds: shotIds ?? [],
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
    ['shotIds'],
    issues,
    DELETE_CONTEXT,
    'Send only the shotIds field.'
  );

  const shotIds = readShotIds(record, issues, DELETE_CONTEXT);

  finishOrThrow(issues);
  return { shotIds: shotIds ?? [] };
}

function readShotIds(
  record: Record<string, unknown>,
  issues: DiagnosticIssue[],
  context: string
): string[] | null {
  const value = record.shotIds;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER342',
        'shotIds must be a non-empty array of shot ids.',
        { path: ['shotIds'], context },
        'Send the ordered shot ids that share the production group.'
      )
    );
    return null;
  }
  return value as string[];
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
