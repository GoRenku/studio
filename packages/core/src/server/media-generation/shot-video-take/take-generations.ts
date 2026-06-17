import type {
  SceneShotVideoTakeGeneration,
  ShotVideoTakeGenerationContext,
} from '../../../client/index.js';
import {
  insertSceneShotVideoTakeGenerationRecord,
  listSceneShotVideoTakeGenerationsForScene,
  requireSceneShotVideoTakeGeneration,
  updateSceneShotVideoTakeGenerationProductionRecord,
  updateSceneShotVideoTakeGenerationShotMembershipRecord,
} from '../../database/access/scene-shot-video-take-generations.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../entity-ids.js';
import type {
  CreateSceneShotVideoTakeGenerationInput,
  ListSceneShotVideoTakeGenerationsInput,
  ReadSceneShotVideoTakeGenerationInput,
  UpdateSceneShotVideoTakeGenerationProductionInput,
  UpdateSceneShotVideoTakeGenerationShotsInput,
} from '../../project-data-service-contracts.js';
import {
  buildContextFromPrepared,
} from './context.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from './project-session.js';
import {
  prepareSceneShotVideoTakeGenerationInSession,
} from './take-generation-context.js';

export async function createSceneShotVideoTakeGeneration(
  input: CreateSceneShotVideoTakeGenerationInput
): Promise<SceneShotVideoTakeGeneration> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    return insertSceneShotVideoTakeGenerationRecord(session, {
      id: ids('scene_shot_video_take_generation'),
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      title: input.title,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
  });
}

export async function readSceneShotVideoTakeGeneration(
  input: ReadSceneShotVideoTakeGenerationInput
): Promise<SceneShotVideoTakeGeneration> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    return requireSceneShotVideoTakeGeneration(session, {
      takeGenerationId: input.takeGenerationId,
      screenplay,
    });
  });
}

export async function listSceneShotVideoTakeGenerations(
  input: ListSceneShotVideoTakeGenerationsInput
): Promise<{ takeGenerations: SceneShotVideoTakeGeneration[] }> {
  return withShotProjectSession(input, ({ session }) => {
    const screenplay = requireScreenplayDocument(session);
    return {
      takeGenerations: listSceneShotVideoTakeGenerationsForScene(session, {
        sceneId: input.sceneId,
        screenplay,
      }),
    };
  });
}

export async function updateSceneShotVideoTakeGenerationProduction(
  input: UpdateSceneShotVideoTakeGenerationProductionInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    updateSceneShotVideoTakeGenerationProductionRecord(session, {
      takeGenerationId: input.takeGenerationId,
      production: input.production,
      screenplay,
      now: new Date().toISOString(),
    });
    const prepared = prepareSceneShotVideoTakeGenerationInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}

export async function updateSceneShotVideoTakeGenerationShots(
  input: UpdateSceneShotVideoTakeGenerationShotsInput
): Promise<ShotVideoTakeGenerationContext> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const screenplay = requireScreenplayDocument(session);
    updateSceneShotVideoTakeGenerationShotMembershipRecord(session, {
      takeGenerationId: input.takeGenerationId,
      shotIds: input.shotIds,
      screenplay,
      now: new Date().toISOString(),
    });
    const prepared = prepareSceneShotVideoTakeGenerationInSession({
      session,
      input,
    });
    return buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
  });
}
