import { desc, eq } from 'drizzle-orm';
import type {
  ScreenplayAnalysis,
  ScreenplayAnalysisStructureModel,
  ScreenplayAnalysisSummary,
} from '../../client/screenplay-analysis/index.js';
import type { Screenplay } from '../../client/screenplay/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { screenplayAnalysis, screenplayAnalysisState } from '../schema/index.js';
import { parseStoredScreenplayAnalysis, serializeScreenplayAnalysis } from './validation.js';

const STATE_ID = 'screenplay_analysis_state';
export type ScreenplayAnalysisRecord = typeof screenplayAnalysis.$inferSelect;
export type ScreenplayAnalysisStateRecord = typeof screenplayAnalysisState.$inferSelect;

export function listScreenplayAnalysisRecords(input: {
  session: DatabaseSession;
  screenplay: Screenplay;
}): ScreenplayAnalysisSummary[] {
  const activeAnalysisId = readActiveScreenplayAnalysisId(input.session);
  return input.session.db.select().from(screenplayAnalysis)
    .orderBy(desc(screenplayAnalysis.updatedAt), desc(screenplayAnalysis.id)).all()
    .map((row) => toScreenplayAnalysisSummary({ row, screenplay: input.screenplay, activeAnalysisId }));
}

export function readScreenplayAnalysisRecord(session: DatabaseSession, analysisId: string): ScreenplayAnalysisRecord | null {
  return session.db.select().from(screenplayAnalysis).where(eq(screenplayAnalysis.id, analysisId)).get() ?? null;
}

export function requireScreenplayAnalysisRecord(session: DatabaseSession, analysisId: string): ScreenplayAnalysisRecord {
  const row = readScreenplayAnalysisRecord(session, analysisId);
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA261', `Screenplay Analysis was not found: ${analysisId}.`, {
      suggestion: 'Use an analysis id from `renku screenplay analyze list --json`.',
    });
  }
  return row;
}

export function writeScreenplayAnalysisRecord(input: {
  session: DatabaseSession;
  id: string;
  analysis: ScreenplayAnalysis;
  screenplay: Screenplay;
  now: string;
  filePath?: string;
}): ScreenplayAnalysisRecord {
  const document = serializeScreenplayAnalysis({
    analysis: input.analysis,
    screenplay: input.screenplay,
    filePath: input.filePath,
  });
  input.session.db.insert(screenplayAnalysis).values({
    id: input.id,
    structureModel: input.analysis.structureModel,
    document,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
  return requireScreenplayAnalysisRecord(input.session, input.id);
}

export function readStoredScreenplayAnalysis(input: {
  row: ScreenplayAnalysisRecord;
  screenplay: Screenplay;
}): ScreenplayAnalysis {
  return parseStoredScreenplayAnalysis({
    value: input.row.document,
    screenplay: input.screenplay,
    path: ['screenplayAnalysis', input.row.id, 'document'],
  });
}

export function readActiveScreenplayAnalysisId(session: DatabaseSession): string | null {
  return session.db.select().from(screenplayAnalysisState)
    .where(eq(screenplayAnalysisState.id, STATE_ID)).get()?.activeAnalysisId ?? null;
}

export function readActiveScreenplayAnalysisRecord(session: DatabaseSession): ScreenplayAnalysisRecord | null {
  const id = readActiveScreenplayAnalysisId(session);
  return id ? readScreenplayAnalysisRecord(session, id) : null;
}

export function setActiveScreenplayAnalysisRecord(
  session: DatabaseSession,
  input: { analysisId: string; now: string },
): void {
  requireScreenplayAnalysisRecord(session, input.analysisId);
  session.db.insert(screenplayAnalysisState).values({
    id: STATE_ID,
    activeAnalysisId: input.analysisId,
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoUpdate({
    target: screenplayAnalysisState.id,
    set: { activeAnalysisId: input.analysisId, updatedAt: input.now },
  }).run();
}

export function toScreenplayAnalysisSummary(input: {
  row: ScreenplayAnalysisRecord;
  screenplay: Screenplay;
  activeAnalysisId?: string | null;
}): ScreenplayAnalysisSummary {
  const analysis = readStoredScreenplayAnalysis({ row: input.row, screenplay: input.screenplay });
  return {
    id: input.row.id,
    structureModel: input.row.structureModel as ScreenplayAnalysisStructureModel,
    title: analysis.title,
    summary: analysis.summary,
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
    isActive: input.activeAnalysisId === input.row.id,
  };
}
