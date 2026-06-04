import type {
  LocationAzimuthViewId,
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

export interface ShotCastReferencesRequest {
  castMemberIds: string[];
}

export function readShotCastReferencesRequest(
  input: unknown
): ShotCastReferencesRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['castMemberIds'],
    issues,
    CONTEXT,
    'Send only the castMemberIds field.'
  );
  const castMemberIds = readStringArray(
    record.castMemberIds,
    ['castMemberIds'],
    issues
  );
  finishOrThrow(issues);
  return { castMemberIds };
}

export interface ShotLocationReferenceRequest {
  locationId: string;
  azimuthView?: LocationAzimuthViewId;
}

export function readShotLocationReferenceRequest(
  input: unknown
): ShotLocationReferenceRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['locationId', 'azimuthView'],
    issues,
    CONTEXT,
    'Send only the locationId and azimuthView fields.'
  );
  const locationId = readStringValue(record.locationId, ['locationId'], issues);
  const azimuthView =
    record.azimuthView === undefined
      ? undefined
      : readLocationAzimuthView(record.azimuthView, issues);
  finishOrThrow(issues);
  return {
    locationId,
    ...(azimuthView ? { azimuthView } : {}),
  };
}

export interface ShotLookbookReferenceRequest {
  lookbookImageId: string | null;
}

export function readShotLookbookReferenceRequest(
  input: unknown
): ShotLookbookReferenceRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['lookbookImageId'],
    issues,
    CONTEXT,
    'Send only the lookbookImageId field.'
  );
  const lookbookImageId =
    record.lookbookImageId === null
      ? null
      : readStringValue(record.lookbookImageId, ['lookbookImageId'], issues);
  finishOrThrow(issues);
  return { lookbookImageId };
}

export interface ShotCustomReferenceImagesRequest {
  customReferenceInputIds: string[];
}

export function readShotCustomReferenceImagesRequest(
  input: unknown
): ShotCustomReferenceImagesRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['customReferenceInputIds'],
    issues,
    CONTEXT,
    'Send only the customReferenceInputIds field.'
  );
  const customReferenceInputIds = readStringArray(
    record.customReferenceInputIds,
    ['customReferenceInputIds'],
    issues
  );
  finishOrThrow(issues);
  return { customReferenceInputIds };
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

function readStringArray(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): string[] {
  if (!Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER342',
        `${path.join('.')} must be an array.`,
        { path, context: CONTEXT },
        'Send an array of ids.'
      )
    );
    return [];
  }
  return value.flatMap((item, index) => {
    if (typeof item === 'string' && item.trim()) {
      return [item];
    }
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER343',
        `${path.join('.')} must contain only string ids.`,
        { path: [...path, String(index)], context: CONTEXT },
        'Send each id as a non-empty string.'
      )
    );
    return [];
  });
}

function readStringValue(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  issues.push(
    createDiagnosticError(
      'STUDIO_SERVER347',
      `${path.join('.')} must be a string.`,
      { path, context: CONTEXT },
      'Send a non-empty string id.'
    )
  );
  return '';
}

function readLocationAzimuthView(
  value: unknown,
  issues: DiagnosticIssue[]
): LocationAzimuthViewId {
  if (
    value === 'front' ||
    value === 'right' ||
    value === 'back' ||
    value === 'left'
  ) {
    return value;
  }
  issues.push(
    createDiagnosticError(
      'STUDIO_SERVER348',
      'azimuthView must be front, right, back, or left.',
      { path: ['azimuthView'], context: CONTEXT },
      'Send one supported location view id.'
    )
  );
  return 'front';
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
