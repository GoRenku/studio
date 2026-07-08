import { eq } from 'drizzle-orm';
import { sceneShotVideoTakes } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface SceneShotVideoTakeStorageRecord {
  id: string;
  sceneId: string;
  title: string;
  createdAt: string;
  mediaFolderProjectRelativePath: string | null;
}

export function requireSceneShotVideoTakeStorageRecord(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTakeStorageRecord {
  const row =
    session.db
      .select({
        id: sceneShotVideoTakes.id,
        sceneId: sceneShotVideoTakes.sceneId,
        title: sceneShotVideoTakes.title,
        createdAt: sceneShotVideoTakes.createdAt,
        mediaFolderProjectRelativePath:
          sceneShotVideoTakes.mediaFolderProjectRelativePath,
      })
      .from(sceneShotVideoTakes)
      .where(eq(sceneShotVideoTakes.id, takeId))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA419',
      `Scene Shot Video Take was not found: ${takeId}.`
    );
  }
  return row;
}

export function listSceneShotVideoTakeStorageRecordsForScene(
  session: DatabaseSession,
  sceneId: string
): SceneShotVideoTakeStorageRecord[] {
  return session.db
    .select({
      id: sceneShotVideoTakes.id,
      sceneId: sceneShotVideoTakes.sceneId,
      title: sceneShotVideoTakes.title,
      createdAt: sceneShotVideoTakes.createdAt,
      mediaFolderProjectRelativePath:
        sceneShotVideoTakes.mediaFolderProjectRelativePath,
    })
    .from(sceneShotVideoTakes)
    .where(eq(sceneShotVideoTakes.sceneId, sceneId))
    .all();
}

export function assignSceneShotVideoTakeMediaFolder(
  session: DatabaseSession,
  input: {
    takeId: string;
    mediaFolderProjectRelativePath: string;
    now: string;
  }
): void {
  session.db
    .update(sceneShotVideoTakes)
    .set({
      mediaFolderProjectRelativePath: input.mediaFolderProjectRelativePath,
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
}
