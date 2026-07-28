import {
  parseStudioSelection,
  type StudioSelection,
} from '@gorenku/studio-core/server';
import {
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { readHttpRequestRecord } from './request-validation.js';

export function readMovieStudioSelectionRequest(input: unknown): {
  selection: StudioSelection;
} {
  const context = 'movie studio selection context request';
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, context);
  if (!record) {
    throwMovieStudioSelectionRequestError(issues);
  }
  const selection = parseStudioSelection(record.selection, {
    path: ['selection'],
    context,
  });
  if (!selection.valid) {
    throwMovieStudioSelectionRequestError([...issues, ...selection.issues]);
  }
  return { selection: selection.selection };
}

function throwMovieStudioSelectionRequestError(
  issues: DiagnosticIssue[]
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER034',
    message: 'Invalid movie studio selection context request.',
    issues,
    suggestion: 'Send a supported Movie Studio selection object.',
  });
}
