import type { AssetFileOwner } from '../../client/asset-files.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { readShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { readShotRecord } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  studioAssetFileOwnerSurfaceResourceKeys,
  studioSceneShotPlansResourceKey,
  studioShotPlanAssetFilesResourceKey,
} from '../studio-coordination/resource-keys.js';

export function assetFileOwnerResourceKeys(
  session: DatabaseSession,
  owner: AssetFileOwner
): string[] {
  if (owner.kind !== 'shot') {
    return studioAssetFileOwnerSurfaceResourceKeys(owner);
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

export function shotPlanAssetFileResourceKeys(session: DatabaseSession, assetFileId: string): string[] {
  const assetFile = readAssetFileRecordIncludingDiscarded(session, assetFileId);
  if (!assetFile?.authoredFromShotPlanId) {
    return [];
  }
  if (['shot_plan_video_reference', 'shot_plan_video_first_frame', 'shot_plan_video_last_frame', 'shot_plan_video_storyboard'].includes(assetFile.type)) {
    return [studioShotPlanAssetFilesResourceKey(assetFile.authoredFromShotPlanId)];
  }
  if (assetFile.type !== 'shot_plan_previs') {
    return [];
  }
  const plan = readShotPlanRecord(session, assetFile.authoredFromShotPlanId);
  return plan ? [studioSceneShotPlansResourceKey(plan.sceneId)] : [];
}
