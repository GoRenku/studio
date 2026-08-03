import type {
  ScreenplayAnalysisListReport,
  ScreenplayAnalysisReadReport,
  ScreenplayAnalysisValidationReport,
  ScreenplayAnalysisWriteReport,
} from '../../../client/screenplay-analysis/index.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import type {
  ReadScreenplayAnalysisInput,
  ScreenplayAnalysisProjectInput,
  SetActiveScreenplayAnalysisInput,
  ValidateScreenplayAnalysisInput,
  WriteScreenplayAnalysisInput,
} from '../../project-data-service-contracts.js';
import { readCanonicalScreenplay } from '../../screenplay/projections/screenplay.js';
import {
  listScreenplayAnalysisRecords,
  readActiveScreenplayAnalysisId,
  readActiveScreenplayAnalysisRecord,
  readStoredScreenplayAnalysis,
  requireScreenplayAnalysisRecord,
  setActiveScreenplayAnalysisRecord,
  toScreenplayAnalysisSummary,
  writeScreenplayAnalysisRecord,
} from '../persistence.js';
import { analysisResourceKeys } from '../story-arc-resource.js';
import { assertScreenplayAnalysis } from '../validation.js';

export async function listScreenplayAnalyses(
  input: ScreenplayAnalysisProjectInput = {},
): Promise<ScreenplayAnalysisListReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = readCanonicalScreenplay(session);
    return {
      valid: true,
      warnings: [],
      project: projectIdentity(currentProject),
      resourceKeys: analysisResourceKeys(),
      analyses: listScreenplayAnalysisRecords({ session, screenplay }),
      activeAnalysisId: readActiveScreenplayAnalysisId(session),
    };
  });
}

export async function readScreenplayAnalysis(
  input: ReadScreenplayAnalysisInput,
): Promise<ScreenplayAnalysisReadReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = readCanonicalScreenplay(session);
    const activeAnalysisId = readActiveScreenplayAnalysisId(session);
    const row = input.active
      ? readActiveScreenplayAnalysisRecord(session)
      : requireScreenplayAnalysisRecord(session, requiredAnalysisId(input.analysisId));
    if (!row) {
      return {
        valid: true,
        warnings: [],
        project: projectIdentity(currentProject),
        resourceKeys: analysisResourceKeys(),
        analysis: null,
        summary: null,
        activeAnalysisId,
      };
    }
    return {
      valid: true,
      warnings: [],
      project: projectIdentity(currentProject),
      resourceKeys: analysisResourceKeys(row.id),
      analysis: readStoredScreenplayAnalysis({ row, screenplay }),
      summary: toScreenplayAnalysisSummary({ row, screenplay, activeAnalysisId }),
      activeAnalysisId,
    };
  });
}

export async function validateScreenplayAnalysis(
  input: ValidateScreenplayAnalysisInput,
): Promise<ScreenplayAnalysisValidationReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = readCanonicalScreenplay(session);
    const warnings = assertScreenplayAnalysis({ analysis: input.analysis, screenplay, filePath: input.filePath });
    return {
      valid: true,
      warnings,
      project: projectIdentity(currentProject),
      resourceKeys: analysisResourceKeys(),
      analysis: input.analysis,
    };
  });
}

export async function writeScreenplayAnalysis(
  input: WriteScreenplayAnalysisInput,
): Promise<ScreenplayAnalysisWriteReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = readCanonicalScreenplay(session);
    const warnings = assertScreenplayAnalysis({ analysis: input.analysis, screenplay, filePath: input.filePath });
    const analysisId = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator())('screenplay_analysis');
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      writeScreenplayAnalysisRecord({ session: txSession, id: analysisId, analysis: input.analysis, screenplay, now, filePath: input.filePath });
      setActiveScreenplayAnalysisRecord(txSession, { analysisId, now });
    });
    const row = requireScreenplayAnalysisRecord(session, analysisId);
    return {
      valid: true,
      warnings,
      project: projectIdentity(currentProject),
      resourceKeys: analysisResourceKeys(analysisId),
      analysis: toScreenplayAnalysisSummary({ row, screenplay, activeAnalysisId: analysisId }),
      activeAnalysisId: analysisId,
      changes: [
        { type: 'screenplayAnalysis.created', analysisId },
        { type: 'screenplayAnalysis.activeSet', analysisId },
      ],
    };
  });
}

export async function setActiveScreenplayAnalysis(
  input: SetActiveScreenplayAnalysisInput,
): Promise<ScreenplayAnalysisWriteReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const screenplay = readCanonicalScreenplay(session);
    const now = new Date().toISOString();
    setActiveScreenplayAnalysisRecord(session, { analysisId: input.analysisId, now });
    const row = requireScreenplayAnalysisRecord(session, input.analysisId);
    return {
      valid: true,
      warnings: [],
      project: projectIdentity(currentProject),
      resourceKeys: analysisResourceKeys(input.analysisId),
      analysis: toScreenplayAnalysisSummary({ row, screenplay, activeAnalysisId: input.analysisId }),
      activeAnalysisId: input.analysisId,
      changes: [{ type: 'screenplayAnalysis.activeSet', analysisId: input.analysisId }],
    };
  });
}

function projectIdentity(project: { projectId: string; projectName: string }): { id: string; projectName: string } {
  return { id: project.projectId, projectName: project.projectName };
}

function requiredAnalysisId(value: string | undefined): string {
  if (value?.trim()) {
    return value.trim();
  }
  throw new ProjectDataError('PROJECT_DATA262', 'Screenplay Analysis id is required.', {
    suggestion: 'Use --analysis <analysis-id> or --active.',
  });
}
