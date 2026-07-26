import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { scenes } from '../schema/index.js';

export function requireScene(session: DatabaseSession, sceneId: string): void {
  const scene = session.db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .get();
  if (!scene) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_SCENE_NOT_FOUND',
      `Scene was not found: ${sceneId}.`
    );
  }
}
