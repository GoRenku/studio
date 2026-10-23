import { readActiveScreenplayAnalysisId } from '../../screenplay-analysis/persistence.js';
import type { ProductionPathStageReader } from '../stage-status.js';

/** Complete once the screenplay has an active analysis. */
export const readScreenplayAnalysisStage: ProductionPathStageReader = (session) => ({
  id: 'screenplayAnalysis',
  status: readActiveScreenplayAnalysisId(session) ? 'complete' : 'notStarted',
  progress: null,
});
