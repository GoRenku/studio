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

export function readMarkdownAssetContentRequest(input: unknown): {
  content: string;
} {
  const context = 'markdown asset content request';
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, context);
  if (!record) {
    throwMarkdownAssetContentRequestError(issues);
  }

  assertHttpRequestFields(
    record,
    [],
    ['content'],
    issues,
    context,
    'Send only the editable Markdown asset content field.'
  );
  const content = readRequiredHttpString(record, ['content'], issues, context);
  const result = buildDiagnosticResult(issues);
  if (!result.valid || content === null) {
    throwMarkdownAssetContentRequestError(result.issues);
  }

  return { content };
}

function throwMarkdownAssetContentRequestError(
  issues: DiagnosticIssue[]
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER014',
    message: 'Markdown asset content request failed validation.',
    issues,
    suggestion: 'Send a content string for the Markdown asset.',
  });
}
