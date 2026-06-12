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

const CONTEXT = 'cast member request';

export interface CastMemberVoiceOverRequest {
  isVoiceOver: boolean;
}

export function readCastMemberVoiceOverRequest(
  input: unknown
): CastMemberVoiceOverRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['isVoiceOver'],
    issues,
    CONTEXT,
    'Send only the isVoiceOver field.'
  );
  if (typeof record.isVoiceOver !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER360',
        'isVoiceOver must be a boolean.',
        { path: ['isVoiceOver'], context: CONTEXT },
        'Send true for a voice-over Cast Member or false for a visual Cast Member.'
      )
    );
  }
  finishOrThrow(issues);
  return { isVoiceOver: record.isVoiceOver as boolean };
}

function finishOrThrow(issues: DiagnosticIssue[]): void {
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwRequestError(result.issues);
  }
}

function throwRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER361',
    message: 'Cast member request failed validation.',
    issues,
    suggestion: 'Send an isVoiceOver boolean.',
  });
}
