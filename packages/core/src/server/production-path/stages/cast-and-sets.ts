import { readProjectCounts } from '../../database/access/project-counts.js';
import type { ProductionPathStageReader } from '../stage-status.js';

/** Complete once there is at least one Cast Member and one Location; Props are optional. */
export const readCastAndSetsStage: ProductionPathStageReader = (session) => {
  const counts = readProjectCounts(session);
  if (counts.castMembers > 0 && counts.locations > 0) {
    return { id: 'castAndSets', status: 'complete', progress: null };
  }
  const anyAuthored = counts.castMembers + counts.locations + counts.props > 0;
  return { id: 'castAndSets', status: anyAuthored ? 'started' : 'notStarted', progress: null };
};
