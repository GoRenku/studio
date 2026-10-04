import type { DiscardShotPlanAssetFileInput } from '../../client/shot-plan-assets.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { withProject } from '../project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioShotPlanAssetFilesResourceKey } from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

const shotPlanAssetFileTypes = new Set([
  'shot_plan_video_first_frame',
  'shot_plan_video_last_frame',
  'shot_plan_video_storyboard',
  'shot_plan_video_reference',
]);

export async function discardShotPlanAssetFile(
  input: DiscardShotPlanAssetFileInput,
): Promise<RecoverableMutationReport> {
  return withProject(input, ({ session, projectFolder }) => {
    requireShotPlanRecord(session, input.shotPlanId);
    const assetFile = readOwnedAssetFile(session, {
      owner: { kind: 'project' },
      assetFileId: input.assetFileId,
    });
    if (!assetFile
      || assetFile.authoredFrom?.id !== input.shotPlanId
      || !shotPlanAssetFileTypes.has(assetFile.type)) {
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
      itemKind: 'assetFile',
      itemId: input.assetFileId,
      commandName: 'shotPlan.asset.discard',
      changes: [{ type: 'shotPlan.assetDiscarded', shotPlanId: input.shotPlanId, assetFileId: input.assetFileId }],
      resourceKeys: [studioShotPlanAssetFilesResourceKey(input.shotPlanId)],
    });
  });
}
