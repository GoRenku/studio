import type {
  ShotVideoTakeProductionGroup,
  SceneShotMediaGenerationTarget,
  ShotVideoTakeProductionPlan,
  SceneShot,
} from '../../../client/index.js';
import {
  requireSceneShotListForScene,
  readSceneShotListDocument,
  updateSceneShotListRecordDocument,
} from '../../database/access/scene-shot-lists.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  createUniqueIdAllocator,
  createRandomIdGenerator,
} from '../../entity-ids.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ShotVideoTakeContextInput,
} from '../../project-data-service-contracts.js';
import {
  requireScreenplayDocument,
} from './project-session.js';



export interface PreparedShotGroup {
  shotListId: string;
  sceneId: string;
  shotListRow: ReturnType<typeof requireSceneShotListForScene>;
  shotList: ReturnType<typeof readSceneShotListDocument>;
  productionGroup: ShotVideoTakeProductionGroup;
  orderedShotIds: string[];
  target: SceneShotMediaGenerationTarget;
}



export function prepareShotGroupInSession(input: {
  session: DatabaseSession;
  input: ShotVideoTakeContextInput;
  now: string;
  production?: ShotVideoTakeProductionPlan;
  persist?: boolean;
}): PreparedShotGroup {
  const screenplay = requireScreenplayDocument(input.session);
  const shotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.input.sceneId,
    shotListId: input.input.shotListId,
  });
  const shotList = readSceneShotListDocument({ row: shotListRow, screenplay });
  const orderedShotIds = normalizeShotIds(shotList.shots, input.input.shotIds);
  const ids = createUniqueIdAllocator(input.input.idGenerator ?? createRandomIdGenerator());
  const productionGroups = (shotList.videoTakeProductionGroups ?? []).filter(
    (group) => group.shotIds.length > 0
  );
  const existingIndex = productionGroups.findIndex((group) =>
    input.input.productionGroupId
      ? group.productionGroupId === input.input.productionGroupId
      : sameShotIds(group.shotIds, orderedShotIds)
  );
  const productionGroup =
    existingIndex >= 0
      ? {
          ...productionGroups[existingIndex],
          shotIds: orderedShotIds,
          videoTakeProduction:
            input.production ?? productionGroups[existingIndex].videoTakeProduction,
        }
      : {
          productionGroupId: input.input.productionGroupId ?? ids('scene_shot_video_take_group'),
          shotIds: orderedShotIds,
          videoTakeProduction: input.production ?? {},
        };
  if (existingIndex >= 0) {
    productionGroups[existingIndex] = productionGroup;
  } else {
    productionGroups.push(productionGroup);
  }
  const updatedShotList = {
    ...shotList,
    videoTakeProductionGroups: productionGroups
      .filter((group) => group.shotIds.length > 0)
      .map((group) => ({
        ...group,
        shotIds: normalizeShotIds(shotList.shots, group.shotIds),
      })),
  };
  if (input.persist !== false) {
    updateSceneShotListRecordDocument({
      session: input.session,
      id: input.input.shotListId,
      document: updatedShotList,
      screenplay,
      now: input.now,
    });
  }
  const target = {
    kind: 'sceneShotGroup' as const,
    id: sceneShotGroupTargetId({
      sceneId: input.input.sceneId,
      shotListId: input.input.shotListId,
      productionGroupId: productionGroup.productionGroupId,
    }),
    sceneId: input.input.sceneId,
    shotListId: input.input.shotListId,
    productionGroupId: productionGroup.productionGroupId,
    shotIds: orderedShotIds,
  };
  return {
    shotListId: input.input.shotListId,
    sceneId: input.input.sceneId,
    shotListRow,
    shotList: updatedShotList,
    productionGroup,
    orderedShotIds,
    target,
  };
}



export function normalizeShotIds(shots: SceneShot[], shotIds: string[]): string[] {
  if (shotIds.length === 0) {
    throw new ProjectDataError('PROJECT_DATA379', 'Shot video take target requires at least one shot id.');
  }
  const valid = new Set(shots.map((shot) => shot.shotId));
  const unique = new Set<string>();
  for (const shotId of shotIds) {
    if (!valid.has(shotId)) {
      throw new ProjectDataError('PROJECT_DATA325', `Shot id is not in the Scene Shot List: ${shotId}.`);
    }
    if (unique.has(shotId)) {
      throw new ProjectDataError('PROJECT_DATA380', `Shot id is duplicated in the production group: ${shotId}.`);
    }
    unique.add(shotId);
  }
  const ordered = shots
    .filter((shot) => unique.has(shot.shotId))
    .map((shot) => shot.shotId);
  if (!isContiguous(ordered, shots)) {
    throw new ProjectDataError('PROJECT_DATA381', 'Grouped shot video takes must use contiguous shot ids.');
  }
  return ordered;
}



export function isContiguous(shotIds: string[], shots: SceneShot[]): boolean {
  if (shotIds.length < 2) {
    return true;
  }
  const indexes = shotIds.map((shotId) => shots.findIndex((shot) => shot.shotId === shotId));
  return indexes.every((index, position) => position === 0 || index === indexes[position - 1] + 1);
}



export function sceneShotGroupTargetId(input: {
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
}): string {
  return `${input.sceneId}:${input.shotListId}:${input.productionGroupId}`;
}



export function requireShot(shots: SceneShot[], shotId: string): SceneShot {
  const shot = shots.find((candidate) => candidate.shotId === shotId);
  if (!shot) {
    throw new ProjectDataError('PROJECT_DATA325', `Shot id is not in the Scene Shot List: ${shotId}.`);
  }
  return shot;
}



export function sameShotIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((shotId, index) => shotId === right[index]);
}
