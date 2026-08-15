import {
  DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA,
  type ScreenplayAnalysisContextReport,
} from '../../client/screenplay-analysis/index.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { listLocationRecords } from '../database/access/locations.js';
import { listPropRecords } from '../database/access/props.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import {
  readActiveScreenplayAnalysisRecord,
  toScreenplayAnalysisSummary,
} from './persistence.js';
import { screenplayAnalysisMethod } from './eligibility.js';
import { screenplayAnalysisFreshness } from './freshness.js';

export function projectScreenplayAnalysisContext(input: {
  session: DatabaseSession;
  project: { id: string; projectName: string };
}): Omit<ScreenplayAnalysisContextReport, 'valid' | 'warnings' | 'resourceKeys'> {
  const screenplay = readCanonicalScreenplay(input.session);
  const project = readProjectInformationResourceFromDatabase(input.session);
  const active = readActiveScreenplayAnalysisRecord(input.session);
  const analysisMethod = screenplayAnalysisMethod(screenplay);
  const activeAnalysisFreshness = active
    ? screenplayAnalysisFreshness(input.session, active)
    : 'current';
  return {
    analysisMethod,
    project: {
      ...input.project,
      title: project.title,
      ...(project.logline ? { logline: project.logline } : {}),
      ...(project.synopsis ? { synopsis: project.synopsis } : {}),
      ...(project.premise ? { premise: project.premise } : {}),
      ...(project.intendedAudience ? { intendedAudience: project.intendedAudience } : {}),
      ...(project.format ? { format: project.format } : {}),
      ...(project.targetRuntimeMinutes !== undefined ? { targetRuntimeMinutes: project.targetRuntimeMinutes } : {}),
      ...(project.primaryGenre ? { primaryGenre: project.primaryGenre } : {}),
      ...(project.secondaryGenres ? { secondaryGenres: project.secondaryGenres } : {}),
      ...(project.tones ? { tones: project.tones } : {}),
      ...(project.contentRatingIntent ? { contentRatingIntent: project.contentRatingIntent } : {}),
      ...(project.creativeBoundaries ? { creativeBoundaries: project.creativeBoundaries } : {}),
      ...(project.centralConflict ? { centralConflict: project.centralConflict } : {}),
      ...(project.dramaticQuestion ? { dramaticQuestion: project.dramaticQuestion } : {}),
      ...(project.themes ? { themes: project.themes } : {}),
      ...(project.historicalBasis ? { historicalBasis: project.historicalBasis } : {}),
      ...(project.dramatizedElements ? { dramatizedElements: project.dramatizedElements } : {}),
      ...(project.screenplayDraftStatus ? { screenplayDraftStatus: project.screenplayDraftStatus } : {}),
      ...(project.researchSources ? { researchSources: project.researchSources } : {}),
      ...(project.assumptions ? { assumptions: project.assumptions } : {}),
      ...(project.openQuestions ? { openQuestions: project.openQuestions } : {}),
      ...(project.nextSteps ? { nextSteps: project.nextSteps } : {}),
    },
    screenplay: {
      opening: screenplay.opening,
      scenes: screenplay.scenes,
      references: screenplay.references,
    },
    cast: listCastMemberRecords(input.session).map((member) => ({
      id: member.id,
      handle: member.handle,
      name: member.name,
      isVoiceOver: member.isVoiceOver,
      ...(member.role ? { role: member.role } : {}),
      ...(member.age !== null ? { age: member.age } : {}),
      ...(member.want ? { want: member.want } : {}),
      ...(member.need ? { need: member.need } : {}),
      ...(member.arc ? { arc: member.arc } : {}),
      ...(member.description ? { description: member.description } : {}),
    })),
    locations: listLocationRecords(input.session).map((location) => ({
      id: location.id,
      handle: location.handle,
      name: location.name,
      ...(location.timePeriod ? { timePeriod: location.timePeriod } : {}),
      ...(location.description ? { description: location.description } : {}),
    })),
    props: listPropRecords(input.session).map((prop) => ({
      id: prop.id,
      handle: prop.handle,
      name: prop.name,
      ...(prop.description ? { description: prop.description } : {}),
    })),
    defaultCriteria: [...DEFAULT_SCREENPLAY_ANALYSIS_CRITERIA],
    activeAnalysis: active
      ? toScreenplayAnalysisSummary({ session: input.session, row: active, activeAnalysisId: active.id })
      : null,
    activeAnalysisFreshness,
  };
}
