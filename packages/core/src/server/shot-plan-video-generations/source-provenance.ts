import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readShotPlanRecordIncludingDiscarded } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { and, eq, isNull } from 'drizzle-orm';
import { trashItems } from '../schema/index.js';
import { studioSceneVideoGenerationsResourceKey } from '../studio-coordination/resource-keys.js';

export function shotPlanVideoAssetResourceKeys(
  session: DatabaseSession,
  assetId: string,
): string[] {
  const asset = readAssetRecord(session, assetId);
  if (
    asset?.type !== 'shot_plan_video'
    || asset.mediaKind !== 'video'
    || readAssetMembershipRecord(session, assetId)?.ownerKey !== 'project'
  ) {
    return [];
  }
  const sceneId = asset.authoredFromShotPlanId
    ? shotPlanVideoSourceSceneId(session, asset.authoredFromShotPlanId)
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
