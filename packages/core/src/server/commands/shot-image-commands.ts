import type {
  DiscardShotImageCandidateInput,
} from '../../client/shot-plans.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { requireShotInPlan } from '../database/access/shot-plans/shot-records.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { studioSceneShotPlansResourceKey } from '../studio-coordination/resource-keys.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

export async function discardShotImageCandidate(
  input: DiscardShotImageCandidateInput
): Promise<RecoverableMutationReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    const plan = requireShotPlanRecord(session, input.shotPlanId);
    requireShotInPlan(session, input);
    const asset = readOwnedAsset(session, {
      owner: { kind: 'shot', id: input.shotId },
      assetId: input.assetId,
    });
    if (!asset || asset.type !== 'shot_image') {
      throw new ProjectDataError(
        'CORE_SHOT_IMAGE_INVALID',
        'Shot image candidate must be an active shot_image Asset owned by the exact Shot.'
      );
    }
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }
    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'asset',
      itemId: input.assetId,
      commandName: 'shotPlan.shot.image.discard',
      changes: [{
        type: 'shot.imageCandidateDiscarded',
        shotId: input.shotId,
        assetId: input.assetId,
      }],
      resourceKeys: [studioSceneShotPlansResourceKey(plan.sceneId)],
    });
  });
}
