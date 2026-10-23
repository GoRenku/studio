import { readProjectCounts } from '../../database/access/project-counts.js';
import { countScenesWithShotPlans } from '../../database/access/shot-plans/plan-records.js';
import { statusFromProgress, type ProductionPathStageReader } from '../stage-status.js';

/** Scenes with at least one active Shot Plan, out of all scenes. */
export const readShotPlansStage: ProductionPathStageReader = (session) => {
  const progress = {
    done: countScenesWithShotPlans(session),
    total: readProjectCounts(session).scenes,
  };
  return { id: 'shotPlans', status: statusFromProgress(progress), progress };
};
