import { and, eq, isNull } from 'drizzle-orm';
import type {
  SceneShotPlanVideoGenerations,
  ShotPlanVideoGenerationGroup,
} from '../../client/shot-plan-video-generations.js';
import { listAssetFilesInSession } from '../asset-files/projection.js';
import { listSceneShotPlanRecords } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { trashItems } from '../schema/index.js';
import { studioSceneVideoGenerationsResourceKey } from '../studio-coordination/resource-keys.js';

export function projectSceneShotPlanVideoGenerations(
  session: DatabaseSession,
  sceneId: string,
): SceneShotPlanVideoGenerations {
  const activePlans = listSceneShotPlanRecords(session, sceneId);
  const activePlanIds = new Set(activePlans.map((plan) => plan.id));
  const assetsByPlanId = new Map<string, ReturnType<typeof listProjectVideos>>();
  const miscellaneous: ReturnType<typeof listProjectVideos> = [];

  for (const assetFile of listProjectVideos(session)) {
    const shotPlanId = assetFile.authoredFrom?.id;
    if (!shotPlanId) {
      continue;
    }
    if (activePlanIds.has(shotPlanId)) {
      const assetFiles = assetsByPlanId.get(shotPlanId) ?? [];
      assetFiles.push(assetFile);
      assetsByPlanId.set(shotPlanId, assetFiles);
      continue;
    }
    if (hasActiveShotPlanTrashItem(session, shotPlanId, sceneId)) {
      miscellaneous.push(assetFile);
    }
  }

  const groups: ShotPlanVideoGenerationGroup[] = activePlans.flatMap((plan) => {
    const assetFiles = assetsByPlanId.get(plan.id);
    return assetFiles?.length
      ? [{
          kind: 'shotPlan' as const,
          shotPlan: { id: plan.id, title: plan.title },
          assetFiles,
        }]
      : [];
  });
  if (miscellaneous.length > 0) {
    groups.push({ kind: 'miscellaneous', assetFiles: miscellaneous });
  }

  return {
    sceneId,
    groups,
    resourceKeys: [studioSceneVideoGenerationsResourceKey(sceneId)],
  };
}

function listProjectVideos(session: DatabaseSession) {
  return listAssetFilesInSession(session, {
    owner: { kind: 'project' },
    type: 'shot_plan_video',
    mediaKind: 'video',
  });
}

function hasActiveShotPlanTrashItem(
  session: DatabaseSession,
  shotPlanId: string,
  sceneId: string,
): boolean {
  return Boolean(session.db
    .select({ id: trashItems.id })
    .from(trashItems)
    .where(and(
      eq(trashItems.itemKind, 'shotPlan'),
      eq(trashItems.itemId, shotPlanId),
      eq(trashItems.ownerKind, 'scene'),
      eq(trashItems.ownerId, sceneId),
      isNull(trashItems.restoredAt),
      isNull(trashItems.garbageCollectedAt),
    ))
    .get());
}
