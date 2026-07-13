import type { SceneShotVideoTakeStructureMode } from '@gorenku/studio-core/client';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readRequiredHttpBoolean,
  readHttpRequestRecord,
} from './request-validation.js';

const CONTEXT = 'scene shot video take request';

export interface SceneShotVideoTakeCreateRequest {
  shotListId: string;
  shotIds: string[];
  title?: string;
}

export function readSceneShotVideoTakeCreateRequest(
  input: unknown
): SceneShotVideoTakeCreateRequest {
  const issues: DiagnosticIssue[] = [];
  const record = requireRequest(input, issues);
  assertHttpRequestFields(
    record,
    [],
    ['shotListId', 'shotIds', 'title'],
    issues,
    CONTEXT,
    'Send only shotListId, shotIds, and title.'
  );
  const shotListId = readStringValue(record.shotListId, ['shotListId'], issues);
  const shotIds = readStringArray(record.shotIds, ['shotIds'], issues);
  const title = record.title === undefined
    ? undefined
    : readStringValue(record.title, ['title'], issues);
  requireShotIds(record.shotIds, shotIds, issues);
  finishOrThrow(issues);
  return { shotListId, shotIds, ...(title ? { title } : {}) };
}

export function readSceneShotVideoTakeShotsRequest(
  input: unknown
): { shotIds: string[] } {
  const issues: DiagnosticIssue[] = [];
  const record = requireRequest(input, issues);
  assertHttpRequestFields(
    record,
    [],
    ['shotIds'],
    issues,
    CONTEXT,
    'Send only shotIds.'
  );
  const shotIds = readStringArray(record.shotIds, ['shotIds'], issues);
  requireShotIds(record.shotIds, shotIds, issues);
  finishOrThrow(issues);
  return { shotIds };
}

export function readSceneShotVideoTakePickRequest(
  input: unknown
): { picked: boolean } {
  const issues: DiagnosticIssue[] = [];
  const record = requireRequest(input, issues);
  assertHttpRequestFields(
    record,
    [],
    ['picked'],
    issues,
    CONTEXT,
    'Send only picked.'
  );
  const picked = readRequiredHttpBoolean(record, ['picked'], issues, CONTEXT);
  finishOrThrow(issues);
  return { picked: picked ?? false };
}

export function readSceneShotVideoTakeStructureModeRequest(
  input: unknown
): { mode: SceneShotVideoTakeStructureMode; sourceShotId?: string } {
  const issues: DiagnosticIssue[] = [];
  const record = requireRequest(input, issues);
  assertHttpRequestFields(
    record,
    [],
    ['mode', 'sourceShotId'],
    issues,
    CONTEXT,
    'Send only mode and sourceShotId.'
  );
  const mode = readStructureModeValue(record.mode, ['mode'], issues);
  const sourceShotId = record.sourceShotId === undefined
    ? undefined
    : readStringValue(record.sourceShotId, ['sourceShotId'], issues);
  finishOrThrow(issues);
  return { mode, ...(sourceShotId ? { sourceShotId } : {}) };
}

function requireRequest(
  input: unknown,
  issues: DiagnosticIssue[]
): Record<string, unknown> {
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) throwRequestError(issues);
  return record;
}

function requireShotIds(
  raw: unknown,
  shotIds: string[],
  issues: DiagnosticIssue[]
): void {
  if (Array.isArray(raw) && shotIds.length === 0) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER343',
        'shotIds must contain at least one Shot id.',
        { path: ['shotIds'], context: CONTEXT },
        'Send at least one Shot id.'
      )
    );
  }
}

function readStructureModeValue(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): SceneShotVideoTakeStructureMode {
  if (value === 'continuous' || value === 'multi-cut') return value;
  issues.push(
    createDiagnosticError(
      'STUDIO_SERVER344',
      'mode must be continuous or multi-cut.',
      { path, context: CONTEXT }
    )
  );
  return 'continuous';
}

function readStringArray(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): string[] {
  if (!Array.isArray(value)) {
    issues.push(createDiagnosticError('STUDIO_SERVER342', 'Value must be an array.', { path, context: CONTEXT }));
    return [];
  }
  return value.flatMap((entry, index) => {
    const result = readStringValue(entry, [...path, String(index)], issues);
    return result ? [result] : [];
  });
}

function readStringValue(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  issues.push(createDiagnosticError('STUDIO_SERVER342', 'Value must be a non-empty string.', { path, context: CONTEXT }));
  return '';
}

function finishOrThrow(issues: DiagnosticIssue[]): void {
  const result = buildDiagnosticResult(issues);
  if (!result.valid) throwRequestError(result.issues);
}

function throwRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER341',
    message: 'Scene Shot Video Take request failed validation.',
    issues,
  });
}
