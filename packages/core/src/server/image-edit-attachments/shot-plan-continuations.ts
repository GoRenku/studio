import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioShotPlanImageAssetsResourceKey } from '../studio-coordination/resource-keys.js';
import type {
  ImageEditContinuation,
  ImageEditContinuationInput,
} from './continuation-registry.js';

const roles = {
  shot_plan_video_first_frame: 'first-frame',
  shot_plan_video_last_frame: 'last-frame',
  shot_plan_video_storyboard: 'storyboard',
  shot_plan_video_reference: 'reference',
} as const;

export function resolveShotPlanImageEditContinuation(
  input: ImageEditContinuationInput,
): ImageEditContinuation | null {
  const role = roles[input.source.type as keyof typeof roles];
  if (!role) {
    return null;
  }
  const { source } = input;
  const shotPlanId = source.authoredFrom?.id;
  if (source.owner.kind !== 'project' || !shotPlanId) {
    throw ownerInvalid(source.id, source.type);
  }
  requireShotPlanRecord(input.session, shotPlanId);
  return {
    owner: { kind: 'project' },
    assetType: source.type,
    destination: { kind: 'shotPlan.videoReferenceImage', shotPlanId, role },
    fileRole: 'primary',
    authoredFromShotPlanId: shotPlanId,
    resourceKeys: [studioShotPlanImageAssetsResourceKey(shotPlanId)],
  };
}

function ownerInvalid(assetId: string, assetType: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_OWNER_INVALID',
    `Asset ${assetId} has ownership that is invalid for ${assetType}.`,
  );
}
