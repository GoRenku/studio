import { desc, eq } from 'drizzle-orm';
import type {
  ScreenplayAnalysisDocument,
  ScreenplayAnalysisSummary,
  ScreenplayAnalysisStructureModel,
} from '../../../client/screenplay-analysis.js';
import type { ScreenplayDocument } from '../../../client/screenplay.js';
import {
  screenplayAnalysis,
  screenplayAnalysisState,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  parseStoredScreenplayAnalysisDocument,
  serializeScreenplayAnalysisDocument,
} from '../../screenplay-analysis-json/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export const SCREENPLAY_ANALYSIS_STATE_ID = 'screenplay_analysis_state';

export type ScreenplayAnalysisRecord = typeof screenplayAnalysis.$inferSelect;
export type ScreenplayAnalysisStateRecord =
  typeof screenplayAnalysisState.$inferSelect;

export function listScreenplayAnalysisRecords(input: {
  session: DatabaseSession;
  screenplay: ScreenplayDocument;
}): ScreenplayAnalysisSummary[] {
  const activeAnalysisId = readActiveScreenplayAnalysisId(input.session);
  return input.session.db
    .select()
    .from(screenplayAnalysis)
    .orderBy(desc(screenplayAnalysis.updatedAt), desc(screenplayAnalysis.id))
    .all()
    .map((row) =>
      toScreenplayAnalysisSummary({
        row,
        screenplay: input.screenplay,
        activeAnalysisId,
      })
    );
}

export function readScreenplayAnalysisRecord(
  session: DatabaseSession,
  analysisId: string
): ScreenplayAnalysisRecord | null {
  return (
    session.db
      .select()
      .from(screenplayAnalysis)
      .where(eq(screenplayAnalysis.id, analysisId))
      .get() ?? null
  );
}

export function requireScreenplayAnalysisRecord(
  session: DatabaseSession,
  analysisId: string
): ScreenplayAnalysisRecord {
  const row = readScreenplayAnalysisRecord(session, analysisId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA261',
      `Screenplay Analysis was not found: ${analysisId}.`,
      { suggestion: 'Use an analysis id from `renku screenplay analyze list --json`.' }
    );
  }
  return row;
}

export function writeScreenplayAnalysisRecord(input: {
  session: DatabaseSession;
  id: string;
  document: ScreenplayAnalysisDocument;
  screenplay: ScreenplayDocument;
  now: string;
  filePath?: string;
}): ScreenplayAnalysisRecord {
  const document = serializeScreenplayAnalysisDocument({
    document: input.document,
    screenplay: input.screenplay,
    filePath: input.filePath,
  });
  input.session.db
    .insert(screenplayAnalysis)
    .values({
      id: input.id,
      structureModel: input.document.structureModel,
      document,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  return requireScreenplayAnalysisRecord(input.session, input.id);
}

export function readScreenplayAnalysisDocument(input: {
  row: ScreenplayAnalysisRecord;
  screenplay: ScreenplayDocument;
}): ScreenplayAnalysisDocument {
  return parseStoredScreenplayAnalysisDocument({
    value: input.row.document,
    screenplay: input.screenplay,
    path: ['screenplayAnalysis', input.row.id, 'document'],
  });
}

export function readScreenplayAnalysisStateRecord(
  session: DatabaseSession
): ScreenplayAnalysisStateRecord | null {
  return (
    session.db
      .select()
      .from(screenplayAnalysisState)
      .where(eq(screenplayAnalysisState.id, SCREENPLAY_ANALYSIS_STATE_ID))
      .get() ?? null
  );
}

export function readActiveScreenplayAnalysisId(
  session: DatabaseSession
): string | null {
  return readScreenplayAnalysisStateRecord(session)?.activeAnalysisId ?? null;
}

export function readActiveScreenplayAnalysisRecord(
  session: DatabaseSession
): ScreenplayAnalysisRecord | null {
  const activeAnalysisId = readActiveScreenplayAnalysisId(session);
  return activeAnalysisId
    ? readScreenplayAnalysisRecord(session, activeAnalysisId)
    : null;
}

export function setActiveScreenplayAnalysisRecord(
  session: DatabaseSession,
  input: { analysisId: string; now: string }
): void {
  requireScreenplayAnalysisRecord(session, input.analysisId);
  const existing = readScreenplayAnalysisStateRecord(session);
  if (existing) {
    session.db
      .update(screenplayAnalysisState)
      .set({
        activeAnalysisId: input.analysisId,
        updatedAt: input.now,
      })
      .where(eq(screenplayAnalysisState.id, SCREENPLAY_ANALYSIS_STATE_ID))
      .run();
    return;
  }
  session.db
    .insert(screenplayAnalysisState)
    .values({
      id: SCREENPLAY_ANALYSIS_STATE_ID,
      activeAnalysisId: input.analysisId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function toScreenplayAnalysisSummary(input: {
  row: ScreenplayAnalysisRecord;
  screenplay: ScreenplayDocument;
  activeAnalysisId?: string | null;
}): ScreenplayAnalysisSummary {
  const document = readScreenplayAnalysisDocument({
    row: input.row,
    screenplay: input.screenplay,
  });
  return {
    id: input.row.id,
    structureModel: input.row.structureModel as ScreenplayAnalysisStructureModel,
    title: document.title,
    summary: document.summary,
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
    isActive: input.activeAnalysisId === input.row.id,
  };
}
