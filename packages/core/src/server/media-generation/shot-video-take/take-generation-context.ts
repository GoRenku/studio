import type {
  SceneShot,
  SceneShotVideoTakeGeneration,
  SceneShotVideoTakeGenerationTarget,
} from '../../../client/index.js';
import {
  requireSceneShotListForScene,
  readSceneShotListDocument,
} from '../../database/access/scene-shot-lists.js';
import {
  requireSceneShotVideoTakeGeneration,
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

export interface PreparedSceneShotVideoTakeGeneration {
  sceneId: string;
  shotListId: string;
  takeGeneration: SceneShotVideoTakeGeneration;
  shotListRow: ReturnType<typeof requireSceneShotListForScene>;
  shotList: ReturnType<typeof readSceneShotListDocument>;
  orderedShotIds: string[];
  target: SceneShotVideoTakeGenerationTarget;
}

export function prepareSceneShotVideoTakeGenerationInSession(input: {
  session: DatabaseSession;
  input: ShotVideoTakeContextInput;
}): PreparedSceneShotVideoTakeGeneration {
  const screenplay = requireScreenplayDocument(input.session);
  const takeGeneration = requireSceneShotVideoTakeGeneration(input.session, {
    takeGenerationId: input.input.takeGenerationId,
    screenplay,
  });
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: takeGeneration.sceneId,
    shotListId: takeGeneration.shotListId,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  return {
    sceneId: takeGeneration.sceneId,
    shotListId: takeGeneration.shotListId,
    takeGeneration,
    shotListRow,
    shotList,
    orderedShotIds: [...takeGeneration.shotIds],
    target: sceneShotVideoTakeGenerationTarget(takeGeneration),
  };
}

export function sceneShotVideoTakeGenerationTarget(
  takeGeneration: Pick<
    SceneShotVideoTakeGeneration,
    'takeGenerationId' | 'sceneId' | 'shotIds'
  >
): SceneShotVideoTakeGenerationTarget {
  return {
    kind: 'sceneShotVideoTakeGeneration',
    id: takeGeneration.takeGenerationId,
    sceneId: takeGeneration.sceneId,
    takeGenerationId: takeGeneration.takeGenerationId,
    shotIds: [...takeGeneration.shotIds],
  };
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
