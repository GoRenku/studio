import type { ProjectInformationPatch } from '../../client/index.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import {
  updateProjectInformationRecord,
  type UpdateProjectInformationRecord,
} from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ResolvedProjectInformation } from './contracts.js';

export function persistProjectInformationScalarPatch(
  session: DatabaseSession,
  projectId: string,
  patch: ProjectInformationPatch,
  information: ResolvedProjectInformation
): void {
  const record: UpdateProjectInformationRecord = {
    updatedAt: new Date().toISOString(),
  };
  if ('title' in patch) {
    record.title = information.title.trim();
  }
  if ('aspectRatio' in patch) {
    record.aspectRatio = effectiveProjectAspectRatio(information.aspectRatio);
  }
  if ('logline' in patch) {
    record.logline = nullableTrimmed(information.logline);
  }
  if ('synopsis' in patch) {
    record.synopsis = nullableTrimmed(information.synopsis);
  }
  if ('premise' in patch) {
    record.premise = nullableTrimmed(information.premise);
  }
  if ('intendedAudience' in patch) {
    record.intendedAudience = nullableTrimmed(information.intendedAudience);
  }
  if ('format' in patch) {
    record.format = nullableTrimmed(information.format);
  }
  if ('targetRuntimeMinutes' in patch) {
    record.targetRuntimeMinutes = information.targetRuntimeMinutes ?? null;
  }
  if ('primaryGenre' in patch) {
    record.primaryGenre = nullableTrimmed(information.primaryGenre);
  }
  if ('secondaryGenres' in patch) {
    record.secondaryGenresJson = nullableStringArrayJson(information.secondaryGenres);
  }
  if ('tones' in patch) {
    record.tonesJson = nullableStringArrayJson(information.tones);
  }
  if ('contentRatingIntent' in patch) {
    record.contentRatingIntent = nullableTrimmed(information.contentRatingIntent);
  }
  if ('creativeBoundaries' in patch) {
    record.creativeBoundariesJson = nullableStringArrayJson(information.creativeBoundaries);
  }
  if ('centralConflict' in patch) {
    record.centralConflict = nullableTrimmed(information.centralConflict);
  }
  if ('dramaticQuestion' in patch) {
    record.dramaticQuestion = nullableTrimmed(information.dramaticQuestion);
  }
  if ('themes' in patch) {
    record.themesJson = nullableStringArrayJson(information.themes);
  }
  if ('historicalBasis' in patch) {
    record.historicalBasisJson = nullableStringArrayJson(information.historicalBasis);
  }
  if ('dramatizedElements' in patch) {
    record.dramatizedElementsJson = nullableStringArrayJson(information.dramatizedElements);
  }
  if ('screenplayDraftStatus' in patch) {
    record.screenplayDraftStatus = nullableTrimmed(information.screenplayDraftStatus);
  }
  if ('researchSources' in patch) {
    record.researchSourcesJson = nullableStringArrayJson(information.researchSources);
  }
  if ('assumptions' in patch) {
    record.assumptionsJson = nullableStringArrayJson(information.assumptions);
  }
  if ('openQuestions' in patch) {
    record.openQuestionsJson = nullableStringArrayJson(information.openQuestions);
  }
  if ('nextSteps' in patch) {
    record.nextStepsJson = nullableStringArrayJson(information.nextSteps);
  }

  if (Object.keys(record).length > 1 || patch.languages !== undefined) {
    updateProjectInformationRecord(session, projectId, record);
  }
}

function nullableTrimmed(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableStringArrayJson(values: string[] | undefined): string | null {
  return values ? JSON.stringify(values.map((value) => value.trim())) : null;
}
