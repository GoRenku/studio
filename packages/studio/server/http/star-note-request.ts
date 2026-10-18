import {
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
  readRequiredHttpString,
} from './request-validation.js';

const STAR_NOTE_CONTEXT = 'Star note request';

export function readStarNoteRequest(input: unknown): { projectName: string } {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, STAR_NOTE_CONTEXT);
  if (!record) {
    throwStarNoteRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['projectName'],
    issues,
    STAR_NOTE_CONTEXT,
    'Send only projectName.'
  );
  const projectName = readRequiredHttpString(record, ['projectName'], issues, STAR_NOTE_CONTEXT);
  if (projectName === null || issues.length > 0) {
    throwStarNoteRequestError(issues);
  }
  return { projectName };
}

function throwStarNoteRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER042',
    message: 'Star note request failed validation.',
    issues,
    suggestion: 'Send one projectName string.',
  });
}
