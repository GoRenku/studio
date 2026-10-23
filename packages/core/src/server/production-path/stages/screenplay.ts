import { readProjectCounts } from '../../database/access/project-counts.js';
import type { ProductionPathStageReader } from '../stage-status.js';

/** Complete once the screenplay has at least one scene. */
export const readScreenplayStage: ProductionPathStageReader = (session) => {
  const scenes = readProjectCounts(session).scenes;
  return {
    id: 'screenplay',
    status: scenes > 0 ? 'complete' : 'notStarted',
    progress: { done: scenes, total: scenes },
  };
};
