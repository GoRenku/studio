import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import { readHttpRequestRecord } from './request-validation.js';

const CONTEXT = 'Location Hero request';

export function readLocationHeroGenerateRequest(input: unknown): {
  sourceLocationSheetAssetId: string;
  approvalToken?: string;
  simulate?: boolean;
  allowUnpricedCost?: boolean;
} {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throw invalidRequest(issues);
  }
  const sourceLocationSheetAssetId =
    typeof record.sourceLocationSheetAssetId === 'string'
      ? record.sourceLocationSheetAssetId.trim()
      : '';
  if (!sourceLocationSheetAssetId) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER370',
        'Location Hero generation requires sourceLocationSheetAssetId.',
        { path: ['sourceLocationSheetAssetId'], context: CONTEXT },
        'Choose the Location Sheet that should seed the Location Hero Image.'
      )
    );
  }
  if (issues.length > 0) {
    throw invalidRequest(issues);
  }
  const approvalToken =
    typeof record.approvalToken === 'string' ? record.approvalToken : undefined;
  return {
    sourceLocationSheetAssetId,
    ...(approvalToken ? { approvalToken } : {}),
    ...(typeof record.simulate === 'boolean' ? { simulate: record.simulate } : {}),
    ...(typeof record.allowUnpricedCost === 'boolean'
      ? { allowUnpricedCost: record.allowUnpricedCost }
      : {}),
  };
}

function invalidRequest(issues: ReturnType<typeof createDiagnosticError>[]) {
  return createStructuredError({
    code: 'STUDIO_SERVER371',
    message: 'Invalid Location Hero request.',
    issues,
    suggestion: 'Send the expected Location Hero generation request body.',
  });
}
