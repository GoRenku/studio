import type { ProjectCreateRequest } from '@gorenku/studio-core/client';
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

const PROJECT_CREATE_CONTEXT = 'Project creation request';

export function readProjectCreateRequest(input: unknown): ProjectCreateRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(
    input,
    [],
    issues,
    PROJECT_CREATE_CONTEXT
  );
  if (!record) {
    throwProjectCreateRequestError(issues);
  }

  assertHttpRequestFields(
    record,
    [],
    ['projectName', 'title'],
    issues,
    PROJECT_CREATE_CONTEXT,
    'Send only projectName and title.'
  );
  const projectName = readRequiredHttpString(
    record,
    ['projectName'],
    issues,
    PROJECT_CREATE_CONTEXT
  );
  const title = readRequiredHttpString(
    record,
    ['title'],
    issues,
    PROJECT_CREATE_CONTEXT
  );
  const result = buildDiagnosticResult(issues);
  if (!result.valid || projectName === null || title === null) {
    throwProjectCreateRequestError(result.issues);
  }

  return { projectName, title };
}

function throwProjectCreateRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER040',
    message: 'Project creation request failed validation.',
    issues,
    suggestion: 'Send projectName and title as strings.',
  });
}
