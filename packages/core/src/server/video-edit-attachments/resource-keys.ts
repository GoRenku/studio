import type { Asset } from '../../client/assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readShotPlanRecordIncludingDiscarded } from '../database/access/shot-plans/plan-records.js';
import {
  studioAssetOwnerSurfaceResourceKeys,
  studioSceneVideoGenerationsResourceKey,
  studioShotPlanAssetsResourceKey,
} from '../studio-coordination/resource-keys.js';

export function videoEditResourceKeys(input: {
  source: Asset;
  session: DatabaseSession;
}): string[] {
  const ownerKeys = studioAssetOwnerSurfaceResourceKeys(input.source.owner);
  if (!input.source.authoredFrom) {
    return ownerKeys;
  }
  if (input.source.type === 'shot_plan_video_reference') {
    return [...ownerKeys, studioShotPlanAssetsResourceKey(input.source.authoredFrom.id)];
  }
  const shotPlan = readShotPlanRecordIncludingDiscarded(
    input.session,
    input.source.authoredFrom.id,
  );
  if (!shotPlan) {
    return ownerKeys;
  }
  return [...new Set([
    ...ownerKeys,
    studioSceneVideoGenerationsResourceKey(shotPlan.sceneId),
  ])];
}
