import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readLatestScreenplayRevisionSummary } from '../screenplay/persistence/revisions.js';
import type { ScreenplayAnalysisRecord } from './persistence.js';

export const SCREENPLAY_ANALYSIS_NEEDS_REFRESH_HELP = 'Screenplay changed since this analysis.';

export type ScreenplayAnalysisFreshness = 'current' | 'needsRefresh';

export function screenplayAnalysisFreshness(
  session: DatabaseSession,
  row: ScreenplayAnalysisRecord,
): ScreenplayAnalysisFreshness {
  const revision = readLatestScreenplayRevisionSummary(session);
  return revision && revision.createdAt > row.updatedAt ? 'needsRefresh' : 'current';
}
