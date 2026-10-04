import type { AssetFile } from '../../client/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readShotPlanRecordIncludingDiscarded } from '../database/access/shot-plans/plan-records.js';
import {
  studioAssetFileOwnerSurfaceResourceKeys,
  studioSceneVideoGenerationsResourceKey,
  studioShotPlanAssetFilesResourceKey,
} from '../studio-coordination/resource-keys.js';

export function videoEditResourceKeys(input: {
  source: AssetFile;
  session: DatabaseSession;
}): string[] {
  const ownerKeys = studioAssetFileOwnerSurfaceResourceKeys(input.source.owner);
  if (!input.source.authoredFrom) {
    return ownerKeys;
  }
  if (input.source.type === 'shot_plan_video_reference') {
    return [...ownerKeys, studioShotPlanAssetFilesResourceKey(input.source.authoredFrom.id)];
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
