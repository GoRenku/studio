import type {
  RecoverableMutationReport,
  SceneShotVideoTake,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import {
  insertSceneShotVideoTakeRecord,
  listSceneShotVideoTakesForScene,
  requireSceneShotVideoTake,
  updateSceneShotVideoTakePickRecord,
  updateSceneShotVideoTakeProductionRecord,
  updateSceneShotVideoTakeShotDesignRecord,
  updateSceneShotVideoTakeShotMembershipRecord,
} from '../../database/access/scene-shot-video-takes.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../entity-ids.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  CreateSceneShotVideoTakeInput,
  DeleteSceneShotVideoTakeInput,
  ListSceneShotVideoTakesInput,
  ReadSceneShotVideoTakeInput,
  UpdateSceneShotVideoTakePickInput,
  UpdateSceneShotVideoTakeProductionInput,
  UpdateSceneShotVideoTakeShotDesignInput,
  UpdateSceneShotVideoTakeShotsInput,
} from '../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
} from './context.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  assertEditableSceneShotVideoTake,
  prepareSceneShotVideoTakeInSession,
} from './take-context.js';
import { shotVideoTakeResourceKeys } from './resource-keys.js';
import { discardTrashObject } from '../../trash/trash-lifecycle-service.js';

export async function createSceneShotVideoTake(
  input: CreateSceneShotVideoTakeInput
): Promise<SceneShotVideoTake> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    return insertSceneShotVideoTakeRecord(session, {
      id: ids('scene_shot_video_take'),
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      title: input.title,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
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
): Promise<{ takes: SceneShotVideoTake[] }> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    return {
      takes: listSceneShotVideoTakesForScene(session, {
        sceneId: input.sceneId,
        screenplay,
      }),
    };
  });
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
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    assertEditableSceneShotVideoTake(prepared.take);
    updateSceneShotVideoTakeProductionRecord(session, {
      takeId: input.takeId,
      production: input.production,
      screenplay,
      now: new Date().toISOString(),
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared: refreshed,
    });
  });
}

export async function updateSceneShotVideoTakeShotDesign(
  input: UpdateSceneShotVideoTakeShotDesignInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    assertEditableSceneShotVideoTake(prepared.take);
    updateSceneShotVideoTakeShotDesignRecord(session, {
      takeId: input.takeId,
      shotId: input.shotId,
      shotDesign: input.shotDesign,
      screenplay,
      now: new Date().toISOString(),
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared: refreshed,
    });
  });
}

export async function updateSceneShotVideoTakeShots(
  input: UpdateSceneShotVideoTakeShotsInput
): Promise<ShotVideoTakeProductionContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    assertEditableSceneShotVideoTake(prepared.take);
    updateSceneShotVideoTakeShotMembershipRecord(session, {
      takeId: input.takeId,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
    const refreshed = prepareSceneShotVideoTakeInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared: refreshed,
    });
  });
}
