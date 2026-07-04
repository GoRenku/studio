import type {
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeTarget,
} from '../../../../../client/index.js';
import {
  requireSceneShotListForScene,
  readSceneShotListDocument,
} from '../../../../database/access/scene-shot-lists.js';
import {
  requireSceneShotVideoTake,
} from '../../../../database/access/scene-shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import type {
  ShotVideoTakeContextInput,
} from '../../../../project-data-service-contracts.js';
import {
  requireScreenplayDocument,
} from '../shared/project-session.js';

export interface PreparedSceneShotVideoTake {
  sceneId: string;
  sourceShotListId: string;
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
  if (input.input.sceneId && take.sceneId !== input.input.sceneId) {
    throw new ProjectDataError(
      'PROJECT_DATA423',
      'Scene Shot Video Take does not belong to the requested scene.',
      {
        suggestion:
          'Refresh the take context and retry the operation from the scene that owns this take.',
      }
    );
  }
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: take.sceneId,
    shotListId: take.sourceShotListId,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  return {
    sceneId: take.sceneId,
    sourceShotListId: take.sourceShotListId,
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
    `Scene Shot Video Take is read-only: ${take.takeId}.`,
    {
      issues: take.status.editability.diagnostics,
      suggestion: take.status.editability.message,
    }
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
