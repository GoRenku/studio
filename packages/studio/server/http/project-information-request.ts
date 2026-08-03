import type { ProjectInformationUpdate } from '@gorenku/studio-core/server';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
  readOptionalHttpString,
  readOptionalHttpNumber,
  readOptionalHttpStringArray,
  readRequiredHttpBoolean,
  readRequiredHttpString,
} from './request-validation.js';

const PROJECT_INFORMATION_CONTEXT = 'project information request';

export function readProjectInformationRequest(
  input: unknown
): ProjectInformationUpdate {
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
    [
      'title', 'aspectRatio', 'logline', 'synopsis', 'premise',
      'intendedAudience', 'format', 'targetRuntimeMinutes', 'primaryGenre',
      'secondaryGenres', 'tones', 'contentRatingIntent', 'creativeBoundaries',
      'centralConflict', 'dramaticQuestion', 'themes', 'historicalBasis',
      'dramatizedElements', 'screenplayDraftStatus', 'researchSources',
      'assumptions', 'openQuestions', 'nextSteps', 'languages',
    ],
    issues,
    PROJECT_INFORMATION_CONTEXT,
    'Send only the supported project information fields.'
  );

  const title = readRequiredHttpString(
    record,
    ['title'],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  const aspectRatio = readOptionalHttpString(
    record,
    ['aspectRatio'],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  const logline = readOptionalHttpString(
    record,
    ['logline'],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  const synopsis = readOptionalHttpString(
    record,
    ['synopsis'],
    issues,
    PROJECT_INFORMATION_CONTEXT
  );
  const premise = readOptionalHttpString(record, ['premise'], issues, PROJECT_INFORMATION_CONTEXT);
  const intendedAudience = readOptionalHttpString(record, ['intendedAudience'], issues, PROJECT_INFORMATION_CONTEXT);
  const format = readOptionalHttpString(record, ['format'], issues, PROJECT_INFORMATION_CONTEXT);
  const targetRuntimeMinutes = readOptionalHttpNumber(record, ['targetRuntimeMinutes'], issues, PROJECT_INFORMATION_CONTEXT);
  const primaryGenre = readOptionalHttpString(record, ['primaryGenre'], issues, PROJECT_INFORMATION_CONTEXT);
  const secondaryGenres = readOptionalHttpStringArray(record, ['secondaryGenres'], issues, PROJECT_INFORMATION_CONTEXT);
  const tones = readOptionalHttpStringArray(record, ['tones'], issues, PROJECT_INFORMATION_CONTEXT);
  const contentRatingIntent = readOptionalHttpString(record, ['contentRatingIntent'], issues, PROJECT_INFORMATION_CONTEXT);
  const creativeBoundaries = readOptionalHttpStringArray(record, ['creativeBoundaries'], issues, PROJECT_INFORMATION_CONTEXT);
  const centralConflict = readOptionalHttpString(record, ['centralConflict'], issues, PROJECT_INFORMATION_CONTEXT);
  const dramaticQuestion = readOptionalHttpString(record, ['dramaticQuestion'], issues, PROJECT_INFORMATION_CONTEXT);
  const themes = readOptionalHttpStringArray(record, ['themes'], issues, PROJECT_INFORMATION_CONTEXT);
  const historicalBasis = readOptionalHttpStringArray(record, ['historicalBasis'], issues, PROJECT_INFORMATION_CONTEXT);
  const dramatizedElements = readOptionalHttpStringArray(record, ['dramatizedElements'], issues, PROJECT_INFORMATION_CONTEXT);
  const screenplayDraftStatus = readOptionalHttpString(record, ['screenplayDraftStatus'], issues, PROJECT_INFORMATION_CONTEXT);
  const researchSources = readOptionalHttpStringArray(record, ['researchSources'], issues, PROJECT_INFORMATION_CONTEXT);
  const assumptions = readOptionalHttpStringArray(record, ['assumptions'], issues, PROJECT_INFORMATION_CONTEXT);
  const openQuestions = readOptionalHttpStringArray(record, ['openQuestions'], issues, PROJECT_INFORMATION_CONTEXT);
  const nextSteps = readOptionalHttpStringArray(record, ['nextSteps'], issues, PROJECT_INFORMATION_CONTEXT);
  const languages = readLanguages(record.languages, ['languages'], issues);
  const result = buildDiagnosticResult(issues);
  if (!result.valid || title === null || languages === null) {
    throwProjectInformationRequestError(result.issues);
  }

  return {
    title,
    aspectRatio,
    logline,
    synopsis,
    premise,
    intendedAudience,
    format,
    targetRuntimeMinutes,
    primaryGenre,
    secondaryGenres,
    tones,
    contentRatingIntent,
    creativeBoundaries,
    centralConflict,
    dramaticQuestion,
    themes,
    historicalBasis,
    dramatizedElements,
    screenplayDraftStatus,
    researchSources,
    assumptions,
    openQuestions,
    nextSteps,
    languages,
  };
}

function readLanguages(
  input: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): ProjectInformationUpdate['languages'] | null {
  if (!Array.isArray(input)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        'languages must be an array.',
        { path, context: PROJECT_INFORMATION_CONTEXT },
        'Send the full project language list as an array.'
      )
    );
    return null;
  }

  const languages: ProjectInformationUpdate['languages'] = [];
  input.forEach((item, index) => {
    const itemPath = [...path, String(index)];
    const record = readHttpRequestRecord(
      item,
      itemPath,
      issues,
      PROJECT_INFORMATION_CONTEXT
    );
    if (!record) {
      return;
    }
    assertHttpRequestFields(
      record,
      itemPath,
      ['localeTag', 'displayName', 'isBase', 'supportsAudio', 'supportsSubtitles'],
      issues,
      PROJECT_INFORMATION_CONTEXT,
      'Send only the supported project information fields.'
    );
    const localeTag = readRequiredHttpString(
      record,
      [...itemPath, 'localeTag'],
      issues,
      PROJECT_INFORMATION_CONTEXT
    );
    const isBase = readRequiredHttpBoolean(
      record,
      [...itemPath, 'isBase'],
      issues,
      PROJECT_INFORMATION_CONTEXT
    );
    const supportsAudio = readRequiredHttpBoolean(
      record,
      [...itemPath, 'supportsAudio'],
      issues,
      PROJECT_INFORMATION_CONTEXT
    );
    const supportsSubtitles = readRequiredHttpBoolean(
      record,
      [...itemPath, 'supportsSubtitles'],
      issues,
      PROJECT_INFORMATION_CONTEXT
    );
    if (
      localeTag === null ||
      isBase === null ||
      supportsAudio === null ||
      supportsSubtitles === null
    ) {
      return;
    }
    languages.push({
      localeTag,
      displayName: readOptionalHttpString(
        record,
        [...itemPath, 'displayName'],
        issues,
        PROJECT_INFORMATION_CONTEXT
      ),
      isBase,
      supportsAudio,
      supportsSubtitles,
    });
  });

  return languages;
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

function throwProjectInformationRequestError(
  issues: DiagnosticIssue[]
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER013',
    message: 'Project information request failed validation.',
    issues,
    suggestion:
      'Send the editable project information fields with a full language list.',
  });
}
