import type { ProjectInformationResource } from '../../../client/index.js';
import type { ProjectInformationUpdate } from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import { readProjectRecord } from './project.js';
import { listProjectLocaleRecords } from './project-locales.js';

export const DEFAULT_MOVIE_PROJECT_ASPECT_RATIO = '16:9';

export function readProjectInformationResourceFromDatabase(
  session: DatabaseSession
): ProjectInformationResource {
  const project = readRequiredProjectRecord(session);
  return {
    title: project.title,
    aspectRatio: effectiveProjectAspectRatio(project.aspectRatio),
    logline: project.logline ?? undefined,
    synopsis: project.synopsis ?? undefined,
    premise: project.premise ?? undefined,
    intendedAudience: project.intendedAudience ?? undefined,
    format: project.format ?? undefined,
    targetRuntimeMinutes: project.targetRuntimeMinutes ?? undefined,
    primaryGenre: project.primaryGenre ?? undefined,
    secondaryGenres: parseStringArray(project.secondaryGenresJson, 'secondaryGenres'),
    tones: parseStringArray(project.tonesJson, 'tones'),
    contentRatingIntent: project.contentRatingIntent ?? undefined,
    creativeBoundaries: parseStringArray(project.creativeBoundariesJson, 'creativeBoundaries'),
    centralConflict: project.centralConflict ?? undefined,
    dramaticQuestion: project.dramaticQuestion ?? undefined,
    themes: parseStringArray(project.themesJson, 'themes'),
    historicalBasis: parseStringArray(project.historicalBasisJson, 'historicalBasis'),
    dramatizedElements: parseStringArray(project.dramatizedElementsJson, 'dramatizedElements'),
    screenplayDraftStatus: project.screenplayDraftStatus ?? undefined,
    researchSources: parseStringArray(project.researchSourcesJson, 'researchSources'),
    assumptions: parseStringArray(project.assumptionsJson, 'assumptions'),
    openQuestions: parseStringArray(project.openQuestionsJson, 'openQuestions'),
    nextSteps: parseStringArray(project.nextStepsJson, 'nextSteps'),
    languages: listProjectLocaleRecords(session).map((row) => ({
      id: row.id,
      localeTag: row.localeTag,
      displayName: row.displayName ?? undefined,
      isBase: row.isBase,
      supportsAudio: row.supportsAudio,
      supportsSubtitles: row.supportsSubtitles,
    })),
  };
}

export function readProjectInformationUpdateFromDatabase(
  session: DatabaseSession
): ProjectInformationUpdate {
  const project = readRequiredProjectRecord(session);
  return {
    title: project.title,
    aspectRatio: effectiveProjectAspectRatio(project.aspectRatio),
    logline: project.logline ?? undefined,
    synopsis: project.synopsis ?? undefined,
    premise: project.premise ?? undefined,
    intendedAudience: project.intendedAudience ?? undefined,
    format: project.format ?? undefined,
    targetRuntimeMinutes: project.targetRuntimeMinutes ?? undefined,
    primaryGenre: project.primaryGenre ?? undefined,
    secondaryGenres: parseStringArray(project.secondaryGenresJson, 'secondaryGenres'),
    tones: parseStringArray(project.tonesJson, 'tones'),
    contentRatingIntent: project.contentRatingIntent ?? undefined,
    creativeBoundaries: parseStringArray(project.creativeBoundariesJson, 'creativeBoundaries'),
    centralConflict: project.centralConflict ?? undefined,
    dramaticQuestion: project.dramaticQuestion ?? undefined,
    themes: parseStringArray(project.themesJson, 'themes'),
    historicalBasis: parseStringArray(project.historicalBasisJson, 'historicalBasis'),
    dramatizedElements: parseStringArray(project.dramatizedElementsJson, 'dramatizedElements'),
    screenplayDraftStatus: project.screenplayDraftStatus ?? undefined,
    researchSources: parseStringArray(project.researchSourcesJson, 'researchSources'),
    assumptions: parseStringArray(project.assumptionsJson, 'assumptions'),
    openQuestions: parseStringArray(project.openQuestionsJson, 'openQuestions'),
    nextSteps: parseStringArray(project.nextStepsJson, 'nextSteps'),
    languages: listProjectLocaleRecords(session).map((row) => ({
      localeTag: row.localeTag,
      displayName: row.displayName ?? undefined,
      isBase: row.isBase,
      supportsAudio: row.supportsAudio,
      supportsSubtitles: row.supportsSubtitles,
    })),
  };
}

function parseStringArray(
  contents: string | null,
  field: string,
): string[] | undefined {
  if (contents === null) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw invalidProjectMetadata(field);
  }
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw invalidProjectMetadata(field);
  }
  return value;
}

function invalidProjectMetadata(field: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA050',
    `Stored Project ${field} JSON is invalid.`,
    { suggestion: 'Repair the Project metadata before reading it.' },
  );
}

export function effectiveProjectAspectRatio(
  aspectRatio: string | null | undefined
): string {
  return aspectRatio ?? DEFAULT_MOVIE_PROJECT_ASPECT_RATIO;
}

function readRequiredProjectRecord(
  session: DatabaseSession
): NonNullable<ReturnType<typeof readProjectRecord>> {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}
