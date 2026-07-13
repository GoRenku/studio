import type { ShotVideoTakeWorkspace } from '../../client/shot-video-take-workspace.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { buildShotVideoTakeGenerationSession } from './generation-session.js';
import { resourceKeys } from './lifecycle-commands.js';
import {
  readShotVideoTakeOverview,
  requireShotVideoTakeSelectionContext,
} from './queries.js';

export async function readShotVideoTakeWorkspace(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  selectedShotId?: string;
}): Promise<ShotVideoTakeWorkspace> {
  requireShotVideoTakeSelectionContext(input);
  const overview = readShotVideoTakeOverview(input);
  const generation = await buildShotVideoTakeGenerationSession(input);
  return {
    take: overview.take,
    sourceShotList: overview.sourceShotList,
    sourceShots: overview.take.shotIds.map(
      (shotId) => overview.displayShots.find((shot) => shot.shotId === shotId)!
    ),
    displayShots: overview.displayShots,
    storyboardImages: overview.storyboardImages,
    generation,
    resourceKeys: resourceKeys(input.sceneId, input.takeId),
  };
}
