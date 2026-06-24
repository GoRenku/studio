import type {
  SceneShotVideoTakeProductionState,
  ShotVideoTakeInputPolicy,
} from '@gorenku/studio-core/client';
import {
  validateShotVideoTakeInputPolicy,
} from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readRequiredHttpBoolean,
  readHttpRequestRecord,
} from './request-validation.js';

const CONTEXT = 'scene shot video take production request';

export interface SceneShotVideoTakeCreateRequest {
  shotListId: string;
  shotIds: string[];
  title?: string;
}

export function readSceneShotVideoTakeCreateRequest(
  input: unknown
): SceneShotVideoTakeCreateRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['shotListId', 'shotIds', 'title'],
    issues,
    CONTEXT,
    'Send only shotListId, shotIds, and title.'
  );
  const shotListId = readStringValue(record.shotListId, ['shotListId'], issues);
  const shotIds = readStringArray(record.shotIds, ['shotIds'], issues);
  const title =
    record.title === undefined
      ? undefined
      : readStringValue(record.title, ['title'], issues);

  if (Array.isArray(record.shotIds) && shotIds.length === 0) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER343',
        'shotIds must contain at least one shot id.',
        { path: ['shotIds'], context: CONTEXT },
        'Send at least one shot id.'
      )
    );
  }
  finishOrThrow(issues);
  return {
    shotListId,
    shotIds,
    ...(title ? { title } : {}),
  };
}

export interface SceneShotVideoTakeProductionRequest {
  production: SceneShotVideoTakeProductionState;
}

export interface SceneShotVideoTakeShotsRequest {
  shotIds: string[];
}

export interface SceneShotVideoTakePickRequest {
  picked: boolean;
}

export function readSceneShotVideoTakeShotsRequest(
  input: unknown
): SceneShotVideoTakeShotsRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['shotIds'],
    issues,
    CONTEXT,
    'Send only the shotIds field.'
  );
  const shotIds = readStringArray(record.shotIds, ['shotIds'], issues);

  if (Array.isArray(record.shotIds) && shotIds.length === 0) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER345',
        'shotIds must contain at least one shot id.',
        { path: ['shotIds'], context: CONTEXT },
        'Send at least one shot id.'
      )
    );
  }
  finishOrThrow(issues);
  return { shotIds };
}

export function readSceneShotVideoTakePickRequest(
  input: unknown
): SceneShotVideoTakePickRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['picked'],
    issues,
    CONTEXT,
    'Send only the picked field.'
  );
  const picked = readRequiredHttpBoolean(record, ['picked'], issues, CONTEXT);
  finishOrThrow(issues);
  return { picked: picked ?? false };
}

export function readSceneShotVideoTakeProductionRequest(
  input: unknown
): SceneShotVideoTakeProductionRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['production'],
    issues,
    CONTEXT,
    'Send only the production field.'
  );
  const production = readProductionValue(record.production, ['production'], issues);
  finishOrThrow(issues);
  return { production };
}

export interface ShotVideoTakeProductionPlanRequest {
  production?: SceneShotVideoTakeProductionState;
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
    ['production', 'inputPolicy'],
    issues,
    CONTEXT,
    'Send only the production and inputPolicy fields.'
  );

  const production =
    record.production === undefined
      ? undefined
      : readProductionValue(record.production, ['production'], issues);
  finishOrThrow(issues);
  return {
    ...(production ? { production } : {}),
    inputPolicy:
      record.inputPolicy === undefined
        ? undefined
        : validateShotVideoTakeInputPolicy(record.inputPolicy),
  };
}

export interface ShotCastCharacterSheetReferenceRequest {
  castMemberId: string;
  assetId: string | null;
}

export function readShotCastCharacterSheetReferenceRequest(
  input: unknown
): ShotCastCharacterSheetReferenceRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['castMemberId', 'assetId'],
    issues,
    CONTEXT,
    'Send only the castMemberId and assetId fields.'
  );
  const castMemberId = readStringValue(record.castMemberId, ['castMemberId'], issues);
  const assetId =
    record.assetId === null
      ? null
      : readStringValue(record.assetId, ['assetId'], issues);
  finishOrThrow(issues);
  return { castMemberId, assetId };
}

export interface ShotLocationSheetReferenceRequest {
  locationId: string;
  assetIds: string[];
}

export function readShotLocationSheetReferenceRequest(
  input: unknown
): ShotLocationSheetReferenceRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['locationId', 'assetIds'],
    issues,
    CONTEXT,
    'Send only the locationId and assetIds fields.'
  );
  const locationId = readStringValue(record.locationId, ['locationId'], issues);
  const assetIds = readStringArray(record.assetIds, ['assetIds'], issues);
  finishOrThrow(issues);
  return { locationId, assetIds };
}

export interface ShotLookbookReferenceRequest {
  lookbookSheetId: string | null;
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
    ['lookbookSheetId'],
    issues,
    CONTEXT,
    'Send only the lookbookSheetId field.'
  );
  const lookbookSheetId =
    record.lookbookSheetId === null
      ? null
      : readStringValue(record.lookbookSheetId, ['lookbookSheetId'], issues);
  finishOrThrow(issues);
  return { lookbookSheetId };
}

export interface ShotReferenceInclusionRequest {
  dependencyId: string;
  inclusion: 'include' | 'exclude' | null;
}

export function readShotReferenceInclusionRequest(
  input: unknown
): ShotReferenceInclusionRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['dependencyId', 'inclusion'],
    issues,
    CONTEXT,
    'Send only the dependencyId and inclusion fields.'
  );
  const dependencyId = readStringValue(record.dependencyId, ['dependencyId'], issues);
  const inclusion = readReferenceInclusionValue(
    record.inclusion,
    ['inclusion'],
    issues
  );
  finishOrThrow(issues);
  return { dependencyId, inclusion };
}

export interface TakeDialogueAudioSelectionRequest {
  dialogueId: string;
  takeId: string | null;
}

export function readTakeDialogueAudioSelectionRequest(
  input: unknown
): TakeDialogueAudioSelectionRequest {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, CONTEXT);
  if (!record) {
    throwRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['dialogueId', 'takeId'],
    issues,
    CONTEXT,
    'Send only the dialogueId and takeId fields.'
  );
  const dialogueId = readStringValue(record.dialogueId, ['dialogueId'], issues);
  const takeId =
    record.takeId === null
      ? null
      : readStringValue(record.takeId, ['takeId'], issues);
  finishOrThrow(issues);
  return { dialogueId, takeId };
}

function readProductionValue(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): SceneShotVideoTakeProductionState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER340',
        `${path.join('.')} must be an object.`,
        { path, context: CONTEXT },
        'Send the structured take production object.'
      )
    );
    throwRequestError(issues);
  }
  return value as SceneShotVideoTakeProductionState;
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

function readReferenceInclusionValue(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): 'include' | 'exclude' | null {
  if (value === null || value === 'include' || value === 'exclude') {
    return value;
  }
  issues.push(
    createDiagnosticError(
      'STUDIO_SERVER349',
      `${path.join('.')} must be include, exclude, or null.`,
      { path, context: CONTEXT },
      'Send include, exclude, or null to clear the override.'
    )
  );
  return null;
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
    suggestion: 'Send the fields supported by the take route.',
  });
}
