import { readShotPlanVideoCoverage } from '../../shot-plan-video-generations/projection.js';
import { statusFromProgress, type ProductionPathStageReader } from '../stage-status.js';

/** Active Shot Plans with at least one generated video, out of all active Shot Plans. */
export const readVideoTakesStage: ProductionPathStageReader = (session) => {
  const coverage = readShotPlanVideoCoverage(session);
  const progress = { done: coverage.shotPlansWithVideo, total: coverage.shotPlans };
  return { id: 'videoTakes', status: statusFromProgress(progress), progress };
};
