import type { ProviderCredentialsUpdate } from '@gorenku/studio-core/client';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
  readRequiredHttpString,
} from './request-validation.js';

const PROVIDER_CREDENTIALS_CONTEXT = 'Provider credential update request';

export function readProviderCredentialsRequest(
  input: unknown
): ProviderCredentialsUpdate {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(
    input,
    [],
    issues,
    PROVIDER_CREDENTIALS_CONTEXT
  );
  if (!record) {
    throwProviderCredentialsRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['changes'],
    issues,
    PROVIDER_CREDENTIALS_CONTEXT,
    'Send only the changes array.'
  );

  const changesValue = record.changes;
  if (!Array.isArray(changesValue)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        'changes must be an array.',
        { path: ['changes'], context: PROVIDER_CREDENTIALS_CONTEXT }
      )
    );
    throwProviderCredentialsRequestError(issues);
  }

  const changes: ProviderCredentialsUpdate['changes'] = [];
  changesValue.forEach((entry, index) => {
    const path = ['changes', String(index)];
    const change = readHttpRequestRecord(
      entry,
      path,
      issues,
      PROVIDER_CREDENTIALS_CONTEXT
    );
    if (!change) {
      return;
    }
    assertHttpRequestFields(
      change,
      path,
      ['provider', 'value'],
      issues,
      PROVIDER_CREDENTIALS_CONTEXT,
      'Send provider and value only.'
    );
    const provider = readRequiredHttpString(
      change,
      [...path, 'provider'],
      issues,
      PROVIDER_CREDENTIALS_CONTEXT
    );
    const value = readRequiredHttpString(
      change,
      [...path, 'value'],
      issues,
      PROVIDER_CREDENTIALS_CONTEXT
    );
    if (provider !== null && value !== null) {
      changes.push({ provider, value });
    }
  });

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwProviderCredentialsRequestError(result.issues);
  }
  return { changes };
}

function throwProviderCredentialsRequestError(
  issues: DiagnosticIssue[]
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER050',
    message: 'Provider credential request failed validation.',
    issues,
    suggestion: 'Send one changes array with provider and API key values.',
  });
}
