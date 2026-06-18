import type {
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeTarget,
} from '../../../client/index.js';
import {
  requireSceneShotListForScene,
  readSceneShotListDocument,
} from '../../database/access/scene-shot-lists.js';
import {
  requireSceneShotVideoTake,
} from '../../database/access/scene-shot-video-take-generations.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ShotVideoTakeContextInput,
} from '../../project-data-service-contracts.js';
import {
  requireScreenplayDocument,
} from './project-session.js';

export interface PreparedSceneShotVideoTake {
  sceneId: string;
  shotListId: string;
  take: SceneShotVideoTake;
  shotListRow: ReturnType<typeof requireSceneShotListForScene>;
  shotList: ReturnType<typeof readSceneShotListDocument>;
  orderedShotIds: string[];
  target: SceneShotVideoTakeTarget;
}

export function prepareSceneShotVideoTakeInSession(input: {
  session: DatabaseSession;
  input: ShotVideoTakeContextInput;
}): PreparedSceneShotVideoTake {
  const screenplay = requireScreenplayDocument(input.session);
  const take = requireSceneShotVideoTake(input.session, {
    takeId: input.input.takeId,
    screenplay,
  });
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: take.sceneId,
    shotListId: take.shotListId,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  return {
    sceneId: take.sceneId,
    shotListId: take.shotListId,
    take,
    shotListRow,
    shotList,
    orderedShotIds: [...take.shotIds],
    target: sceneShotVideoTakeTarget(take),
  };
}

export function sceneShotVideoTakeTarget(
  take: Pick<
    SceneShotVideoTake,
    'takeId' | 'sceneId' | 'shotIds'
  >
): SceneShotVideoTakeTarget {
  return {
    kind: 'sceneShotVideoTake',
    id: take.takeId,
    sceneId: take.sceneId,
    takeId: take.takeId,
    shotIds: [...take.shotIds],
  };
}

export function assertEditableSceneShotVideoTake(
  take: Pick<SceneShotVideoTake, 'status' | 'takeId'>
): void {
  if (take.status.editability.state === 'editable') {
    return;
  }
  throw new ProjectDataError(
    'PROJECT_DATA420',
    `Scene Shot Video Take is read-only: ${take.takeId}.`
  );
}

export function requireShot(shots: SceneShot[], shotId: string): SceneShot {
  const shot = shots.find((candidate) => candidate.shotId === shotId);
  if (!shot) {
    throw new ProjectDataError(
      'PROJECT_DATA325',
      `Shot id is not in the Scene Shot List: ${shotId}.`
    );
  }
  return shot;
}

export function sameShotIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((shotId, index) => shotId === right[index])
  );
}
