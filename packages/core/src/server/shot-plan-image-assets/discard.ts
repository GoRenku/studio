import type { DiscardShotPlanImageAssetInput } from '../../client/shot-plan-image-assets.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { withProject } from '../project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioShotPlanImageAssetsResourceKey } from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

const shotPlanImageTypes = new Set([
  'shot_plan_video_first_frame',
  'shot_plan_video_last_frame',
  'shot_plan_video_storyboard',
  'shot_plan_video_reference',
]);

export async function discardShotPlanImageAsset(
  input: DiscardShotPlanImageAssetInput,
): Promise<RecoverableMutationReport> {
  return withProject(input, ({ session, projectFolder }) => {
    requireShotPlanRecord(session, input.shotPlanId);
    const asset = readOwnedAsset(session, {
      owner: { kind: 'project' },
      assetId: input.assetId,
    });
    if (!asset
      || asset.authoredFrom?.id !== input.shotPlanId
      || !shotPlanImageTypes.has(asset.type)) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_IMAGE_ASSETS_NOT_FOUND',
        'The image is not an active image Asset authored from the exact Shot Plan.',
      );
    }
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
    }
    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'asset',
      itemId: input.assetId,
      commandName: 'shotPlan.imageAsset.discard',
      changes: [{ type: 'shotPlan.imageAssetDiscarded', shotPlanId: input.shotPlanId, assetId: input.assetId }],
      resourceKeys: [studioShotPlanImageAssetsResourceKey(input.shotPlanId)],
    });
  });
}
