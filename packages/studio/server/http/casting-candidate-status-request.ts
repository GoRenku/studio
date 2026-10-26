import {
  CASTING_CANDIDATE_STATUSES,
  type CastingCandidateStatus,
} from '@gorenku/studio-core/client';
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

const CONTEXT = 'casting candidate status request';

export interface CastingCandidateStatusRequest {
  status: CastingCandidateStatus;
}

export function readCastingCandidateStatusRequest(
  input: unknown
): CastingCandidateStatusRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['status'],
    issues,
    CONTEXT,
    'Send only the status field.'
  );
  if (!isCastingCandidateStatus(record.status)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER363',
        `status must be one of ${CASTING_CANDIDATE_STATUSES.join(', ')}.`,
        { path: ['status'], context: CONTEXT },
        'Send candidate or hidden.'
      )
    );
  }
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwRequestError(result.issues);
  }
  return { status: record.status as CastingCandidateStatus };
}

function isCastingCandidateStatus(value: unknown): value is CastingCandidateStatus {
  return CASTING_CANDIDATE_STATUSES.some((status) => status === value);
}

function throwRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER364',
    message: 'Casting candidate status request failed validation.',
    issues,
    suggestion: 'Send a status of candidate or hidden.',
  });
}
