import { readProjectCounts } from '../../database/access/project-counts.js';
import { countScenesWithActiveSceneBeats } from '../../database/access/scene-beats.js';
import { statusFromProgress, type ProductionPathStageReader } from '../stage-status.js';

/** Scenes with at least one active Beat, out of all scenes. */
export const readSceneBeatsStage: ProductionPathStageReader = (session) => {
  const progress = {
    done: countScenesWithActiveSceneBeats(session),
    total: readProjectCounts(session).scenes,
  };
  return { id: 'sceneBeats', status: statusFromProgress(progress), progress };
};
