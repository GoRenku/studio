import type {
  ShotVideoTakeInputPolicy,
  ShotVideoTakeProductionGroup,
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

const CONTEXT = 'scene shot video take production request';

/**
 * Parse the `{ productionGroup }` envelope used by the AI Production autosave
 * and preview routes (0041). The reader only checks the envelope shape; deep
 * validation of intent, model, parameters, and group membership is delegated to
 * core (0040).
 */
export function readShotVideoTakeProductionGroupRequest(
  input: unknown
): ShotVideoTakeProductionGroup {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['productionGroup'],
    issues,
    CONTEXT,
    'Send only the productionGroup field.'
  );

  const productionGroup = readProductionGroupValue(record.productionGroup, issues);

  finishOrThrow(issues);
  return productionGroup;
}

export interface ShotVideoTakeProductionPlanRequest {
  productionGroup: ShotVideoTakeProductionGroup;
  inputPolicy?: ShotVideoTakeInputPolicy;
}

export function readShotVideoTakeProductionPlanRequest(
  input: unknown
): ShotVideoTakeProductionPlanRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['productionGroup', 'inputPolicy'],
    issues,
    CONTEXT,
    'Send only the productionGroup and inputPolicy fields.'
  );

  const productionGroup = readProductionGroupValue(record.productionGroup, issues);

  finishOrThrow(issues);
  return {
    productionGroup,
    inputPolicy: record.inputPolicy as ShotVideoTakeInputPolicy | undefined,
  };
}

function readProductionGroupValue(
  value: unknown,
  issues: DiagnosticIssue[]
): ShotVideoTakeProductionGroup {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER340',
        'productionGroup must be an object.',
        { path: ['productionGroup'], context: CONTEXT },
        'Send the structured production group object.'
      )
    );
    throwRequestError(issues);
  }
  return value as ShotVideoTakeProductionGroup;
}

function finishOrThrow(issues: DiagnosticIssue[]): void {
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwRequestError(result.issues);
  }
}

function throwRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER341',
    message: 'Shot video take production request failed validation.',
    issues,
    suggestion: 'Send a productionGroup object.',
  });
}
