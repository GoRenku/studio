import {
  buildDiagnosticResult,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
  readRequiredHttpString,
} from './request-validation.js';

const PROJECT_DELETE_CONTEXT = 'Project deletion request';

export interface ProjectDeleteRequest {
  confirmationProjectName: string;
}

export function readProjectDeleteRequest(input: unknown): ProjectDeleteRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(
    input,
    [],
    issues,
    PROJECT_DELETE_CONTEXT
  );
  if (!record) {
    throwProjectDeleteRequestError(issues);
  }

  assertHttpRequestFields(
    record,
    [],
    ['confirmationProjectName'],
    issues,
    PROJECT_DELETE_CONTEXT,
    'Send only confirmationProjectName.'
  );
  const confirmationProjectName = readRequiredHttpString(
    record,
    ['confirmationProjectName'],
    issues,
    PROJECT_DELETE_CONTEXT
  );
  const result = buildDiagnosticResult(issues);
  if (!result.valid || confirmationProjectName === null) {
    throwProjectDeleteRequestError(result.issues);
  }

  return { confirmationProjectName };
}

function throwProjectDeleteRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER041',
    message: 'Project deletion request failed validation.',
    issues,
    suggestion: 'Send confirmationProjectName as a string.',
  });
}
