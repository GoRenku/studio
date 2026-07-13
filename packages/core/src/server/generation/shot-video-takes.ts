import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ShotVideoTakeSummary } from '../../client/generation.js';
import { readSceneShotListDocument, requireSceneShotListForScene } from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneShotVideoTakes, sceneShotVideoTakeShots } from '../schema/index.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { readProjectRecord } from '../database/access/project.js';

export function listShotVideoTakes(input: { session: DatabaseSession; sceneId: string }): ShotVideoTakeSummary[] {
  return input.session.db.select().from(sceneShotVideoTakes).where(and(eq(sceneShotVideoTakes.sceneId, input.sceneId), isNull(sceneShotVideoTakes.discardedAt))).orderBy(asc(sceneShotVideoTakes.createdAt), asc(sceneShotVideoTakes.id)).all().map((take) => summary(input.session, take));
}
export function readShotVideoTake(input: { session: DatabaseSession; takeId: string }): ShotVideoTakeSummary {
  const take = input.session.db.select().from(sceneShotVideoTakes).where(and(eq(sceneShotVideoTakes.id, input.takeId), isNull(sceneShotVideoTakes.discardedAt))).get();
  if (!take) {
    throw new ProjectDataError('CORE_GENERATION_TARGET_NOT_FOUND', `Scene Shot Video Take was not found: ${input.takeId}.`);
  }
  return summary(input.session, take);
}
export function createShotVideoTake(input: { session: DatabaseSession; sceneId: string; shotListId: string; shotIds: string[]; idGenerator: ProjectIdGenerator; now: string }): ShotVideoTakeSummary {
  const screenplay = readScreenplayDocumentFromSession(input.session);
  if (!screenplay) {
    throw new ProjectDataError('CORE_GENERATION_CONTEXT_UNAVAILABLE', 'A screenplay is required before creating a Shot Video Take.');
  }
  const shotListRecord = requireSceneShotListForScene({ session: input.session, shotListId: input.shotListId, sceneId: input.sceneId });
  const shotList = readSceneShotListDocument({ row: shotListRecord, screenplay });
  const shots = input.shotIds.map((shotId) => shotList.shots.find((shot) => shot.shotId === shotId));
  if (shots.some((shot) => !shot)) {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Every Shot Video Take shot must belong to its source Scene Shot List.');
  }
  const id = input.idGenerator.next('scene_shot_video_take');
  const title = `Take ${listShotVideoTakes({ session: input.session, sceneId: input.sceneId }).length + 1}`;
  input.session.db.transaction((tx) => {
    tx.insert(sceneShotVideoTakes).values({ id, sceneId: input.sceneId, sourceShotListId: input.shotListId, title, stateJson: '{"version":3}', isPicked: false, regeneratedFromTakeId: null, mediaFolderProjectRelativePath: null, historySnapshot: '{}', createdAt: input.now, updatedAt: input.now }).run();
    for (const [index, shot] of shots.entries()) {
      tx.insert(sceneShotVideoTakeShots).values({ takeId: id, shotId: shot!.shotId, shotOrder: index, shotContentFingerprint: JSON.stringify(shot), storyboardImageId: null, storyboardAssetFileId: null, storyboardContentFingerprint: 'unavailable' }).run();
    }
  });
  return readShotVideoTake({ session: input.session, takeId: id });
}
export function deleteShotVideoTake(input: { session: DatabaseSession; takeId: string; projectFolder: string }): ShotVideoTakeSummary {
  const current = readShotVideoTake(input);
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError('CORE_GENERATION_CONTEXT_UNAVAILABLE', 'Project metadata is required before deleting a Shot Video Take.');
  }
  discardTrashObject({
    session: input.session,
    project,
    projectFolder: input.projectFolder,
    itemKind: 'sceneShotVideoTake',
    itemId: input.takeId,
    commandName: 'scene-shot-video-take.discard',
    changes: [{ type: 'sceneShotVideoTake.discarded', takeId: input.takeId }],
  });
  return current;
}
function summary(session: DatabaseSession, take: typeof sceneShotVideoTakes.$inferSelect): ShotVideoTakeSummary {
  const shotIds = session.db.select({ shotId: sceneShotVideoTakeShots.shotId }).from(sceneShotVideoTakeShots).where(and(eq(sceneShotVideoTakeShots.takeId, take.id), isNull(sceneShotVideoTakeShots.discardedAt))).orderBy(asc(sceneShotVideoTakeShots.shotOrder)).all().map((row) => row.shotId);
  return { id: take.id, sceneId: take.sceneId, sourceShotListId: take.sourceShotListId, title: take.title, shotIds, isPicked: take.isPicked, createdAt: take.createdAt, updatedAt: take.updatedAt };
}
