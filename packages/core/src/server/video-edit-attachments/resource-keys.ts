import type { Asset } from '../../client/assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readShotPlanRecordIncludingDiscarded } from '../database/access/shot-plans/plan-records.js';
import {
  studioAssetOwnerSurfaceResourceKeys,
  studioSceneVideoGenerationsResourceKey,
} from '../studio-coordination/resource-keys.js';

export function videoEditResourceKeys(input: {
  source: Asset;
  session: DatabaseSession;
}): string[] {
  const ownerKeys = studioAssetOwnerSurfaceResourceKeys(input.source.owner);
  if (!input.source.authoredFrom) {
    return ownerKeys;
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
