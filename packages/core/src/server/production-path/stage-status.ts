import type {
  ProductionPathStage,
  ProductionPathStageProgress,
  ProductionPathStageStatus,
} from '../../client/production-path.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export type ProductionPathStageReader = (session: DatabaseSession) => ProductionPathStage;

/** Nothing done is not started, everything done is complete, anything between is started. */
export function statusFromProgress(progress: ProductionPathStageProgress): ProductionPathStageStatus {
  if (progress.done === 0) {
    return 'notStarted';
  }
  return progress.done >= progress.total ? 'complete' : 'started';
}
