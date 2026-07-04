import type {
  RecoverableMutationReport,
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeCreateReport,
  SceneShotVideoTakeListReport,
  SceneShotVideoTakeOverview,
  ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import type {
  ScreenplayDocument,
} from '../../../../../client/screenplay.js';
import {
  readActiveSceneShotListId,
  requireSceneShotListForScene,
  readSceneShotListDocument,
} from '../../../../database/access/scene-shot-lists.js';
import {
  insertSceneShotVideoTakeRecord,
  listSceneShotVideoTakesForScene,
  requireSceneShotVideoTake,
  updateSceneShotVideoTakePickRecord,
  updateSceneShotVideoTakeProductionRecord,
  updateSceneShotVideoTakeDirectionRecord,
  updateSceneShotVideoTakeShotMembershipRecord,
  updateSceneShotVideoTakeStructureModeRecord,
} from '../../../../database/access/scene-shot-video-takes.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../../../entity-ids.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import type {
  CreateSceneShotVideoTakeInput,
  DeleteSceneShotVideoTakeInput,
  ListSceneShotVideoTakesInput,
  ReadSceneShotVideoTakeInput,
  UpdateSceneShotVideoTakePickInput,
  UpdateSceneShotVideoTakeProductionInput,
  UpdateSceneShotVideoTakeDirectionInput,
  UpdateSceneShotVideoTakeShotsInput,
  UpdateSceneShotVideoTakeStructureModeInput,
} from '../../../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
} from '../authoring/context.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
} from '../authoring/take-context.js';
import {
  contextWithIterationResourceKeys,
  continueSceneShotVideoTakeIteration,
} from '../authoring/take-iteration.js';
import {
  retargetTakeScopedProductionState,
} from '../authoring/take-production-state.js';
import {
  applyTakeStateToShot,
} from './take-state.js';
import {
  sceneShotVideoTakeResourceKeys,
  shotVideoTakeResourceKeys,
} from '../shared/resource-keys.js';
import {
  listShotVideoTakeStoryboardImages,
} from '../planning/storyboard-images.js';
import { discardTrashObject } from '../../../../trash/trash-lifecycle-service.js';

export async function createSceneShotVideoTake(
  input: CreateSceneShotVideoTakeInput
): Promise<SceneShotVideoTakeCreateReport> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    const take = insertSceneShotVideoTakeRecord(session, {
      id: ids('scene_shot_video_take'),
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      title: input.title,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
    const activeShotListId = readActiveSceneShotListId(session, input.sceneId);
    return {
      overview: toSceneShotVideoTakeOverview({
        session,
        sceneId: input.sceneId,
        take,
        activeShotListId,
        screenplay,
      }),
      resourceKeys: sceneShotVideoTakeResourceKeys({
        sceneId: input.sceneId,
        takeId: take.takeId,
      }),
    };
  });
}

export async function readSceneShotVideoTake(
  input: ReadSceneShotVideoTakeInput
): Promise<SceneShotVideoTake> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const take = requireSceneShotVideoTake(session, {
      takeId: input.takeId,
      screenplay,
    });
    if (input.sceneId && take.sceneId !== input.sceneId) {
      throw new ProjectDataError(
        'PROJECT_DATA423',
        'Scene Shot Video Take does not belong to the requested scene.',
        {
          suggestion:
            'Refresh the take context and retry the operation from the scene that owns this take.',
        }
      );
    }
    return take;
  });
}

export async function listSceneShotVideoTakes(
  input: ListSceneShotVideoTakesInput
): Promise<SceneShotVideoTakeListReport> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const activeShotListId = readActiveSceneShotListId(session, input.sceneId);
    return {
      takes: listSceneShotVideoTakesForScene(session, {
        sceneId: input.sceneId,
        screenplay,
      }).map((take) =>
        toSceneShotVideoTakeOverview({
          session,
          sceneId: input.sceneId,
          take,
          activeShotListId,
          screenplay,
        })
      ),
    };
  });
}

function toSceneShotVideoTakeOverview(input: {
  session: DatabaseSession;
  sceneId: string;
  take: SceneShotVideoTake;
  activeShotListId: string | null;
  screenplay: ScreenplayDocument;
}): SceneShotVideoTakeOverview {
  const sourceShotListRow = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.sceneId,
    shotListId: input.take.sourceShotListId,
  });
  const sourceShotList = readSceneShotListDocument({
    row: sourceShotListRow,
    screenplay: input.screenplay,
  });
  return {
    take: input.take,
    sourceShotList: {
      id: sourceShotListRow.id,
      title: sourceShotList.title,
      summary: sourceShotList.summary,
      createdAt: sourceShotListRow.createdAt,
      updatedAt: sourceShotListRow.updatedAt,
      isActive: sourceShotListRow.id === input.activeShotListId,
    },
    displayShots: sourceShotList.shots.map((shot) =>
      applyTakeStateToShot({
        shot,
        state: input.take.state,
      })
    ),
    overviewShotIds: sceneShotVideoTakeOverviewShotIds({
      take: input.take,
      sourceShots: sourceShotList.shots,
    }),
    storyboardImages: listShotVideoTakeStoryboardImages({
      session: input.session,
      sceneId: input.sceneId,
      shotListId: sourceShotListRow.id,
    }),
  };
}

function sceneShotVideoTakeOverviewShotIds(input: {
  take: SceneShotVideoTake;
  sourceShots: SceneShot[];
}): string[] {
  if (input.take.shotIds.length > 0) {
    return input.take.shotIds;
  }
  const sourceShotIds = input.sourceShots.map((shot) => shot.shotId);
  if (input.take.state.structure.mode === 'multi-cut') {
    const directionShotIds = new Set(
      Object.keys(input.take.state.structure.directionsByShotId)
    );
    return sourceShotIds.filter((shotId) => directionShotIds.has(shotId));
  }
  return sourceShotIds.slice(0, 1);
}

export async function deleteSceneShotVideoTake(
  input: DeleteSceneShotVideoTakeInput
): Promise<RecoverableMutationReport> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    assertEditableSceneShotVideoTake(prepared.take);
    const resourceKeys = shotVideoTakeResourceKeys(prepared);
    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'sceneShotVideoTake',
      itemId: input.takeId,
      commandName: 'sceneShotVideoTake.delete',
      changes: [
        {
          type: 'sceneShotVideoTake.discarded',
          takeId: input.takeId,
        },
      ],
      resourceKeys,
    });
  });
}

export async function updateSceneShotVideoTakePick(
  input: UpdateSceneShotVideoTakePickInput
): Promise<{ take: SceneShotVideoTake; resourceKeys: string[] }> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    assertEditableSceneShotVideoTake(prepared.take);
    const take = updateSceneShotVideoTakePickRecord(session, {
      takeId: input.takeId,
      picked: input.picked,
      screenplay,
      now: new Date().toISOString(),
    });
    return {
      take,
      resourceKeys: shotVideoTakeResourceKeys({ ...prepared, take }),
    };
  });
}

export async function updateSceneShotVideoTakeProduction(
  input: UpdateSceneShotVideoTakeProductionInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    updateSceneShotVideoTakeProductionRecord(session, {
      takeId: iteration.take.takeId,
      production: retargetTakeScopedProductionState({
        production: input.production,
        targetTakeId: iteration.take.takeId,
      }),
      screenplay,
      now,
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input: { ...input, sceneId: iteration.take.sceneId, takeId: iteration.take.takeId },
    });
    return contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshed,
      }),
      iteration
    );
  });
}

export async function updateSceneShotVideoTakeDirection(
  input: UpdateSceneShotVideoTakeDirectionInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    updateSceneShotVideoTakeDirectionRecord(session, {
      takeId: iteration.take.takeId,
      shotId: input.shotId,
      direction: input.direction,
      screenplay,
      now,
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input: { ...input, sceneId: iteration.take.sceneId, takeId: iteration.take.takeId },
    });
    return contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshed,
      }),
      iteration
    );
  });
}

export async function updateSceneShotVideoTakeStructureMode(
  input: UpdateSceneShotVideoTakeStructureModeInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    updateSceneShotVideoTakeStructureModeRecord(session, {
      takeId: iteration.take.takeId,
      mode: input.mode,
      sourceShotId: input.sourceShotId,
      screenplay,
      now,
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input: { ...input, sceneId: iteration.take.sceneId, takeId: iteration.take.takeId },
    });
    return contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshed,
      }),
      iteration
    );
  });
}

export async function updateSceneShotVideoTakeShots(
  input: UpdateSceneShotVideoTakeShotsInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const now = new Date().toISOString();
    const iteration = continueSceneShotVideoTakeIteration({
      session,
      contextInput: input,
      screenplay,
      now,
    });
    updateSceneShotVideoTakeShotMembershipRecord(session, {
      takeId: iteration.take.takeId,
      shotIds: input.shotIds,
      screenplay,
      now,
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input: { ...input, sceneId: iteration.take.sceneId, takeId: iteration.take.takeId },
    });
    return contextWithIterationResourceKeys(
      buildContextFromPrepared({
        session,
        projectFolder,
        project,
        prepared: refreshed,
      }),
      iteration
    );
  });
}
