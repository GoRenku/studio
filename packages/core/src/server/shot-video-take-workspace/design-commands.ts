import { eq } from 'drizzle-orm';
import type {
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeStructureMode,
  ShotVideoTakeWorkspaceMutationReport,
} from '../../client/shot-video-take-workspace.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { sceneShotVideoTakes } from '../schema/index.js';
import { requireSceneShotVideoTakeAuthoringOpen } from '../database/access/shot-video-take-media.js';
import { resourceKeys } from './lifecycle-commands.js';
import { readShotVideoTakeDomain, requireShotVideoTakeForScene } from './queries.js';
import {
  serializeShotVideoTakeState,
  setShotVideoTakeDirectionState,
  setShotVideoTakeStructureState,
} from './state.js';
import { readShotVideoTakeWorkspace } from './workspace.js';

export async function setShotVideoTakeStructure(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  mode: SceneShotVideoTakeStructureMode;
  sourceShotId?: string;
  now: string;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  requireShotVideoTakeForScene(input);
  requireSceneShotVideoTakeAuthoringOpen(input);
  const take = readShotVideoTakeDomain(input);
  const state = setShotVideoTakeStructureState({
    state: take.state,
    shotIds: take.shotIds,
    mode: input.mode,
    sourceShotId: input.sourceShotId,
  });
  persistState(input.session, input.takeId, state, input.now);
  const workspace = await readShotVideoTakeWorkspace(input);
  return { workspace, resourceKeys: resourceKeys(input.sceneId, input.takeId) };
}

export async function setShotVideoTakeDirection(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  shotId?: string;
  direction: SceneShotVideoTakeDirection | null;
  now: string;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  requireShotVideoTakeForScene(input);
  requireSceneShotVideoTakeAuthoringOpen(input);
  const take = readShotVideoTakeDomain(input);
  const state = setShotVideoTakeDirectionState({
    state: take.state,
    shotIds: take.shotIds,
    shotId: input.shotId,
    direction: input.direction,
  });
  persistState(input.session, input.takeId, state, input.now);
  const workspace = await readShotVideoTakeWorkspace(input);
  return { workspace, resourceKeys: resourceKeys(input.sceneId, input.takeId) };
}

function persistState(
  session: DatabaseSession,
  takeId: string,
  state: ReturnType<typeof setShotVideoTakeDirectionState>,
  now: string
): void {
  session.db
    .update(sceneShotVideoTakes)
    .set({ stateJson: serializeShotVideoTakeState(state), updatedAt: now })
    .where(eq(sceneShotVideoTakes.id, takeId))
    .run();
}
