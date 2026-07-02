import type {
  SceneShotVideoTake,
  SceneShotVideoTakeState,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import type {
  ScreenplayDocument,
} from '../../../client/screenplay.js';
import {
  insertSceneShotVideoTakeRecord,
} from '../../database/access/scene-shot-video-takes.js';
import {
  copySelectedShotVideoTakeInputRecords,
  type CopiedShotVideoTakeInputRecord,
} from '../../database/access/shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../entity-ids.js';
import type {
  ShotVideoTakeContextInput,
} from '../../project-data-service-contracts.js';
import {
  sceneShotVideoTakeResourceKeys,
} from './resource-keys.js';
import {
  retargetTakeScopedProductionState,
} from './take-production-state.js';
import {
  assertEditableSceneShotVideoTake,
  type PreparedSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
} from './take-context.js';

export interface SceneShotVideoTakeIterationTarget {
  sourcePrepared: PreparedSceneShotVideoTake;
  prepared: PreparedSceneShotVideoTake;
  sourceTake: SceneShotVideoTake;
  take: SceneShotVideoTake;
  createdIterationTake: boolean;
  copiedInputs: CopiedShotVideoTakeInputRecord[];
  resourceKeys: string[];
}

export function continueSceneShotVideoTakeIteration(input: {
  session: DatabaseSession;
  contextInput: ShotVideoTakeContextInput;
  screenplay: ScreenplayDocument;
  now: string;
  title?: string;
}): SceneShotVideoTakeIterationTarget {
  const sourcePrepared = prepareSceneShotVideoTakeInSession({
    session: input.session,
    input: input.contextInput,
  });
  assertEditableSceneShotVideoTake(sourcePrepared.take);
  if (!sourcePrepared.take.video) {
    return {
      sourcePrepared,
      prepared: sourcePrepared,
      sourceTake: sourcePrepared.take,
      take: sourcePrepared.take,
      createdIterationTake: false,
      copiedInputs: [],
      resourceKeys: sceneShotVideoTakeResourceKeys({
        sceneId: sourcePrepared.sceneId,
        takeId: sourcePrepared.take.takeId,
      }),
    };
  }

  const ids = createUniqueIdAllocator(
    input.contextInput.idGenerator ?? createRandomIdGenerator()
  );
  const targetTakeId = ids('scene_shot_video_take');
  const copiedState = sceneShotVideoTakeStateForIteration({
    state: sourcePrepared.take.state,
    targetTakeId,
  });
  const targetTake = insertSceneShotVideoTakeRecord(input.session, {
    id: targetTakeId,
    sceneId: sourcePrepared.sceneId,
    shotListId: sourcePrepared.sourceShotListId,
    title: input.title ?? `${sourcePrepared.take.title} iteration`,
    shotIds: sourcePrepared.orderedShotIds,
    state: copiedState,
    regeneratedFromTakeId: sourcePrepared.take.takeId,
    screenplay: input.screenplay,
    now: input.now,
  });
  const copiedInputs = copySelectedShotVideoTakeInputRecords(input.session, {
    sourceTakeId: sourcePrepared.take.takeId,
    targetTakeId: targetTake.takeId,
    now: input.now,
    nextId: ids,
  });
  const prepared = prepareSceneShotVideoTakeInSession({
    session: input.session,
    input: {
      ...input.contextInput,
      sceneId: targetTake.sceneId,
      takeId: targetTake.takeId,
    },
  });

  return {
    sourcePrepared,
    prepared,
    sourceTake: sourcePrepared.take,
    take: prepared.take,
    createdIterationTake: true,
    copiedInputs,
    resourceKeys: [
      ...sceneShotVideoTakeResourceKeys({
        sceneId: sourcePrepared.sceneId,
        takeId: sourcePrepared.take.takeId,
      }),
      ...sceneShotVideoTakeResourceKeys({
        sceneId: prepared.sceneId,
        takeId: prepared.take.takeId,
        inputIds: copiedInputs.map((copy) => copy.input.inputId),
        assetIds: copiedInputs.map((copy) => copy.input.assetId),
      }),
    ],
  };
}

export function contextWithIterationResourceKeys(
  context: ShotVideoTakeProductionContext,
  iteration: SceneShotVideoTakeIterationTarget
): ShotVideoTakeProductionContext {
  return {
    ...context,
    resourceKeys: uniqueResourceKeys([
      ...iteration.resourceKeys,
      ...context.resourceKeys,
    ]),
  };
}

function sceneShotVideoTakeStateForIteration(input: {
  state: SceneShotVideoTakeState;
  targetTakeId: string;
}): SceneShotVideoTakeState {
  const state = structuredClone(input.state);
  return {
    ...state,
    production: retargetTakeScopedProductionState({
      production: state.production,
      targetTakeId: input.targetTakeId,
    }),
  };
}

function uniqueResourceKeys(resourceKeys: string[]): string[] {
  return [...new Set(resourceKeys)];
}
