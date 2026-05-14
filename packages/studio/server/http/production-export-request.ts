import type { ProductionExportInput } from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
} from './request-validation.js';

export async function readOptionalJson(request: {
  json(): Promise<unknown>;
}): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function readProductionExportRequest(input: unknown): Omit<
  ProductionExportInput,
  'projectName'
> {
  const context = 'production export request';
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, context);
  if (!record) {
    throwProductionExportRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['dryRun', 'fresh'],
    issues,
    context,
    'Send only supported production export options.'
  );
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwProductionExportRequestError(result.issues);
  }
  return {
    dryRun: typeof record.dryRun === 'boolean' ? record.dryRun : undefined,
    fresh: typeof record.fresh === 'boolean' ? record.fresh : undefined,
  };
}

function throwProductionExportRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER020',
    message: 'Invalid production export request.',
    issues,
    suggestion: 'Send only supported production export options.',
  });
}
