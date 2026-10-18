import { and, eq, inArray, isNull } from 'drizzle-orm';
import { assetFiles } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

/** Video takes, scene storyboard images, character sheets and location sheets. */
const GENERATION_ACTIVITY_ASSET_FILE_TYPES = [
  'shot_plan_video',
  'scene_storyboard_image',
  'character_sheet',
  'location_sheet',
];

/** True when the project holds at least one generated activity file that is not in Trash. */
export function hasGenerationActivity(session: DatabaseSession): boolean {
  const row = session.db.select({ id: assetFiles.id }).from(assetFiles)
    .where(and(
      eq(assetFiles.origin, 'generated'),
      inArray(assetFiles.type, GENERATION_ACTIVITY_ASSET_FILE_TYPES),
      isNull(assetFiles.discardedAt)
    ))
    .limit(1)
    .get();
  return row !== undefined;
}
