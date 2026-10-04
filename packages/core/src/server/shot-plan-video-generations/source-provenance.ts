import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { readShotPlanRecordIncludingDiscarded } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { and, eq, isNull } from 'drizzle-orm';
import { trashItems } from '../schema/index.js';
import { studioSceneVideoGenerationsResourceKey } from '../studio-coordination/resource-keys.js';

export function shotPlanVideoAssetFileResourceKeys(
  session: DatabaseSession,
  assetFileId: string,
): string[] {
  const assetFile = readAssetFileRecordIncludingDiscarded(session, assetFileId);
  if (
    assetFile?.type !== 'shot_plan_video'
    || assetFile.mediaKind !== 'video'
    || readAssetFileRecordIncludingDiscarded(session, assetFileId)?.ownerKey !== 'project'
  ) {
    return [];
  }
  const sceneId = assetFile.authoredFromShotPlanId
    ? shotPlanVideoSourceSceneId(session, assetFile.authoredFromShotPlanId)
    : null;
  return sceneId ? [studioSceneVideoGenerationsResourceKey(sceneId)] : [];
}

export function shotPlanVideoSourceSceneId(
  session: DatabaseSession,
  shotPlanId: string,
): string | null {
  const shotPlan = readShotPlanRecordIncludingDiscarded(session, shotPlanId);
  if (!shotPlan) {
    return null;
  }
  if (!shotPlan.discardedAt) {
    return shotPlan.sceneId;
  }
  const activeTrashItem = session.db
    .select({ id: trashItems.id })
    .from(trashItems)
    .where(and(
      eq(trashItems.itemKind, 'shotPlan'),
      eq(trashItems.itemId, shotPlan.id),
      eq(trashItems.ownerKind, 'scene'),
      eq(trashItems.ownerId, shotPlan.sceneId),
      isNull(trashItems.restoredAt),
      isNull(trashItems.garbageCollectedAt),
    ))
    .get();
  return activeTrashItem ? shotPlan.sceneId : null;
}
