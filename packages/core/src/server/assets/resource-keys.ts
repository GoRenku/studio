import type { AssetOwner } from '../../client/assets.js';
import { readShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  studioAssetOwnerSurfaceResourceKeys,
  studioSceneShotPlansResourceKey,
} from '../studio-coordination/resource-keys.js';

export function assetOwnerResourceKeys(
  session: DatabaseSession,
  owner: AssetOwner
): string[] {
  if (owner.kind !== 'shot') {
    return studioAssetOwnerSurfaceResourceKeys(owner);
  }
  const shot = readShotRecord(session, owner.id);
  const plan = shot ? readShotPlanRecord(session, shot.shotPlanId) : null;
  if (!shot || !plan) {
    throw new ProjectDataError(
      'CORE_SHOT_NOT_FOUND',
      `Shot was not found: ${owner.id}.`
    );
  }
  return [studioSceneShotPlansResourceKey(plan.sceneId)];
}
