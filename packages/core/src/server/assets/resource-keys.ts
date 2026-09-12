import type { AssetOwner } from '../../client/assets.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  studioAssetOwnerSurfaceResourceKeys,
  studioSceneShotPlansResourceKey,
  studioShotPlanAssetsResourceKey,
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

export function shotPlanAssetResourceKeys(session: DatabaseSession, assetId: string): string[] {
  const asset = readAssetRecord(session, assetId);
  if (!asset?.authoredFromShotPlanId) {
    return [];
  }
  if (['shot_plan_video_reference', 'shot_plan_video_first_frame', 'shot_plan_video_last_frame', 'shot_plan_video_storyboard'].includes(asset.type)) {
    return [studioShotPlanAssetsResourceKey(asset.authoredFromShotPlanId)];
  }
  if (asset.type !== 'shot_plan_previs') {
    return [];
  }
  const plan = readShotPlanRecord(session, asset.authoredFromShotPlanId);
  return plan ? [studioSceneShotPlansResourceKey(plan.sceneId)] : [];
}
