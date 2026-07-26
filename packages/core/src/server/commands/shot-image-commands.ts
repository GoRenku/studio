import type {
  ClearShotRepresentativeImageInput,
  DiscardShotImageCandidateInput,
  SetShotRepresentativeImageInput,
  ShotPlanReport,
} from '../../client/shot-plans.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  clearShotRepresentativeAsset,
  readShotRepresentativeAssetId,
  writeShotRepresentativeAsset,
} from '../database/access/shot-plans/image-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { requireShotInPlan } from '../database/access/shot-plans/shot-records.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { projectShotPlanReport } from '../shot-plans/projection.js';
import { studioSceneShotPlansResourceKey } from '../studio-coordination/resource-keys.js';
import {
  assetRelationshipTrashItemId,
} from '../trash/trash-object-registry.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

export async function setShotRepresentativeImage(
  input: SetShotRepresentativeImageInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    requireShotPlanRecord(session, input.shotPlanId);
    requireShotInPlan(session, input);
    const asset = readAssetRelationship(session, {
      target: { kind: 'shot', shotId: input.shotId },
      assetId: input.assetId,
    });
    const primaryImage = asset?.files.find(
      (file) => file.role === 'primary' && file.mediaKind === 'image'
    );
    if (
      !asset ||
      asset.availability !== 'ready' ||
      asset.mediaKind !== 'image' ||
      asset.role !== 'shot-image' ||
      !primaryImage
    ) {
      throw new ProjectDataError(
        'CORE_SHOT_IMAGE_INVALID',
        'Representative image must be an active ready shot-image attached to the exact Shot with an active primary image file.'
      );
    }
    writeShotRepresentativeAsset(session, {
      shotId: input.shotId,
      assetId: input.assetId,
      now: new Date().toISOString(),
    });
    return projectShotPlanReport({
      session,
      projectFolder,
      shotPlanId: input.shotPlanId,
    });
  });
}

export async function clearShotRepresentativeImage(
  input: ClearShotRepresentativeImageInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    requireShotPlanRecord(session, input.shotPlanId);
    requireShotInPlan(session, input);
    clearShotRepresentativeAsset(session, input.shotId);
    return projectShotPlanReport({
      session,
      projectFolder,
      shotPlanId: input.shotPlanId,
    });
  });
}

export async function discardShotImageCandidate(
  input: DiscardShotImageCandidateInput
): Promise<RecoverableMutationReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    const plan = requireShotPlanRecord(session, input.shotPlanId);
    requireShotInPlan(session, input);
    const target = { kind: 'shot' as const, shotId: input.shotId };
    const asset = readAssetRelationship(session, {
      target,
      assetId: input.assetId,
    });
    if (!asset || asset.role !== 'shot-image') {
      throw new ProjectDataError(
        'CORE_SHOT_IMAGE_INVALID',
        'Shot image candidate must be an active shot-image attached to the exact Shot.'
      );
    }
    if (
      readShotRepresentativeAssetId(session, input.shotId) === input.assetId
    ) {
      throw new ProjectDataError(
        'CORE_SHOT_IMAGE_DISCARD_SELECTED',
        'The selected representative image cannot be discarded.',
        {
          suggestion:
            'Select another candidate or clear the representative image first.',
        }
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
      itemKind: 'assetRelationship',
      itemId: assetRelationshipTrashItemId({
        target,
        assetId: input.assetId,
      }),
      commandName: 'shotPlan.shot.image.discard',
      changes: [
        {
          type: 'shot.imageCandidateDiscarded',
          shotId: input.shotId,
          assetId: input.assetId,
        },
      ],
      resourceKeys: [studioSceneShotPlansResourceKey(plan.sceneId)],
    });
  });
}
