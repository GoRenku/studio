import type { DiscardShotPlanAssetInput } from '../../client/shot-plan-assets.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { withProject } from '../project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioShotPlanAssetsResourceKey } from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

const shotPlanAssetTypes = new Set([
  'shot_plan_video_first_frame',
  'shot_plan_video_last_frame',
  'shot_plan_video_storyboard',
  'shot_plan_video_reference',
]);

export async function discardShotPlanAsset(
  input: DiscardShotPlanAssetInput,
): Promise<RecoverableMutationReport> {
  return withProject(input, ({ session, projectFolder }) => {
    requireShotPlanRecord(session, input.shotPlanId);
    const asset = readOwnedAsset(session, {
      owner: { kind: 'project' },
      assetId: input.assetId,
    });
    if (!asset
      || asset.authoredFrom?.id !== input.shotPlanId
      || !shotPlanAssetTypes.has(asset.type)) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_ASSETS_NOT_FOUND',
        'The Asset is not an active supporting Asset authored from the exact Shot Plan.',
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
      commandName: 'shotPlan.asset.discard',
      changes: [{ type: 'shotPlan.assetDiscarded', shotPlanId: input.shotPlanId, assetId: input.assetId }],
      resourceKeys: [studioShotPlanAssetsResourceKey(input.shotPlanId)],
    });
  });
}
