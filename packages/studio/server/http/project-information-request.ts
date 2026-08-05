import type {
  ProjectInformationPatch,
  ProjectLanguagePatchOperation,
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
  readOptionalHttpNumber,
  readOptionalHttpString,
  readOptionalHttpStringArray,
  readRequiredHttpString,
} from './request-validation.js';

const PROJECT_INFORMATION_CONTEXT = 'project information request';

const PROJECT_INFORMATION_FIELDS = [
  'title', 'aspectRatio', 'logline', 'synopsis', 'premise',
  'intendedAudience', 'format', 'targetRuntimeMinutes', 'primaryGenre',
  'secondaryGenres', 'tones', 'contentRatingIntent', 'creativeBoundaries',
  'centralConflict', 'dramaticQuestion', 'themes', 'historicalBasis',
  'dramatizedElements', 'screenplayDraftStatus', 'researchSources',
  'assumptions', 'openQuestions', 'nextSteps', 'languages',
] as const;

const NULLABLE_STRING_FIELDS = [
  'aspectRatio', 'logline', 'synopsis', 'premise', 'intendedAudience', 'format',
  'primaryGenre', 'contentRatingIntent', 'centralConflict', 'dramaticQuestion',
  'screenplayDraftStatus',
] as const;

const NULLABLE_STRING_ARRAY_FIELDS = [
  'secondaryGenres', 'tones', 'creativeBoundaries', 'themes', 'historicalBasis',
  'dramatizedElements', 'researchSources', 'assumptions', 'openQuestions',
  'nextSteps',
] as const;

export function readProjectInformationRequest(
  input: unknown
): ProjectInformationPatch {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(
    input,
    [],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  if (!record) {
    throwProjectInformationRequestError(issues);
  }

  warnIfProjectNameMutationAttempt(record, issues);
  assertHttpRequestFields(
    record,
    [],
    [...PROJECT_INFORMATION_FIELDS],
    issues,
    PROJECT_INFORMATION_CONTEXT,
    'Send only the supported project information patch fields.'
  );

  const patch: ProjectInformationPatch = {};
  if ('title' in record) {
    const title = readOptionalHttpString(record, ['title'], issues, PROJECT_INFORMATION_CONTEXT);
    if (title !== undefined) {
      patch.title = title;
    }
  }
  for (const field of NULLABLE_STRING_FIELDS) {
    if (field in record) {
      patch[field] = readNullableString(record, field, issues);
    }
  }
  if ('targetRuntimeMinutes' in record) {
    patch.targetRuntimeMinutes = readNullableNumber(
      record,
      'targetRuntimeMinutes',
      issues
    );
  }
  for (const field of NULLABLE_STRING_ARRAY_FIELDS) {
    if (field in record) {
      patch[field] = readNullableStringArray(record, field, issues);
    }
  }
  if ('languages' in record) {
    patch.languages = readLanguageOperations(record.languages, ['languages'], issues);
  }

  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwProjectInformationRequestError(result.issues);
  }
  return patch;
}

function readNullableString(
  record: Record<string, unknown>,
  field: string,
  issues: DiagnosticIssue[]
): string | null | undefined {
  if (record[field] === null) {
    return null;
  }
  return readOptionalHttpString(record, [field], issues, PROJECT_INFORMATION_CONTEXT);
}

function readNullableNumber(
  record: Record<string, unknown>,
  field: string,
  issues: DiagnosticIssue[]
): number | null | undefined {
  if (record[field] === null) {
    return null;
  }
  return readOptionalHttpNumber(record, [field], issues, PROJECT_INFORMATION_CONTEXT);
}

function readNullableStringArray(
  record: Record<string, unknown>,
  field: string,
  issues: DiagnosticIssue[]
): string[] | null | undefined {
  if (record[field] === null) {
    return null;
  }
  return readOptionalHttpStringArray(record, [field], issues, PROJECT_INFORMATION_CONTEXT);
}

function readLanguageOperations(
  input: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): ProjectLanguagePatchOperation[] {
  if (!Array.isArray(input)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        'languages must be an array.',
        { path, context: PROJECT_INFORMATION_CONTEXT },
        'Send project language patch operations as an array.'
      )
    );
    return [];
  }

  const operations: ProjectLanguagePatchOperation[] = [];
  input.forEach((item, index) => {
    const operation = readLanguageOperation(
      item,
      [...path, String(index)],
      issues
    );
    if (operation) {
      operations.push(operation);
    }
  });
  return operations;
}

function readLanguageOperation(
  input: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): ProjectLanguagePatchOperation | null {
  const record = readHttpRequestRecord(
    input,
    path,
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  if (!record) {
    return null;
  }
  const operation = readRequiredHttpString(
    record,
    [...path, 'operation'],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  const localeTag = readRequiredHttpString(
    record,
    [...path, 'localeTag'],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  if (operation === null || localeTag === null) {
    return null;
  }

  if (operation === 'remove' || operation === 'setBase') {
    assertLanguageOperationFields(record, path, ['operation', 'localeTag'], issues);
    return { operation, localeTag };
  }
  if (operation !== 'add' && operation !== 'update') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${operation} is not a supported project language operation.`,
        { path: [...path, 'operation'], context: PROJECT_INFORMATION_CONTEXT },
        'Use add, update, remove, or setBase.'
      )
    );
    return null;
  }

  assertLanguageOperationFields(
    record,
    path,
    ['operation', 'localeTag', 'displayName', 'isBase', 'supportsAudio', 'supportsSubtitles'],
    issues
  );
  const result: Extract<ProjectLanguagePatchOperation, { operation: 'add' | 'update' }> = {
    operation,
    localeTag,
  };
  if ('displayName' in record) {
    if (operation === 'update' && record.displayName === null) {
      result.displayName = null;
    } else {
      const displayName = readOptionalHttpString(
        record,
        [...path, 'displayName'],
        issues,
        PROJECT_INFORMATION_CONTEXT
      );
      if (displayName !== undefined) {
        result.displayName = displayName;
      }
    }
  }
  readOptionalBoolean(record, path, 'isBase', issues, result);
  readOptionalBoolean(record, path, 'supportsAudio', issues, result);
  readOptionalBoolean(record, path, 'supportsSubtitles', issues, result);
  return result;
}

function assertLanguageOperationFields(
  record: Record<string, unknown>,
  path: string[],
  allowedFields: string[],
  issues: DiagnosticIssue[]
): void {
  assertHttpRequestFields(
    record,
    path,
    allowedFields,
    issues,
    PROJECT_INFORMATION_CONTEXT,
    'Send only fields supported by this project language operation.'
  );
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  path: string[],
  field: 'isBase' | 'supportsAudio' | 'supportsSubtitles',
  issues: DiagnosticIssue[],
  result: Extract<ProjectLanguagePatchOperation, { operation: 'add' | 'update' }>
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${[...path, field].join('.')} must be a boolean.`,
        { path: [...path, field], context: PROJECT_INFORMATION_CONTEXT }
      )
    );
    return;
  }
  result[field] = value;
}

function warnIfProjectNameMutationAttempt(
  record: Record<string, unknown>,
  issues: DiagnosticIssue[]
): void {
  if ('name' in record || 'projectName' in record) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER011',
        'Project name cannot be changed from Project Information.',
        {
          path: 'name' in record ? ['name'] : ['projectName'],
          context: PROJECT_INFORMATION_CONTEXT,
        },
        'Project name is immutable after creation.'
      )
    );
  }
}

function throwProjectInformationRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER013',
    message: 'Project information request failed validation.',
    issues,
    suggestion: 'Send a well-formed partial project information patch.',
  });
}
