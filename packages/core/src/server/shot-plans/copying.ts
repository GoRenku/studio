import type { CopyShotPlanInput } from '../../client/shot-plans.js';
import {
  insertAssetRelationshipRecord,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import {
  readShotRepresentativeAssetId,
  writeShotRepresentativeAsset,
} from '../database/access/shot-plans/image-records.js';
import {
  insertShotPlanRecord,
  requireShotPlanRecord,
  setShotPlanLastGenerationSpecId,
} from '../database/access/shot-plans/plan-records.js';
import {
  insertShotRecords,
  listShotRecords,
} from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { copyGenerationSpecForAuthoring } from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';
import { parseStoredShotBrief, parseStoredShotPlanCoverage } from './validation.js';
import { requireScene } from './scene-ownership.js';

export function copyShotPlanAuthoring(input: {
  command: CopyShotPlanInput;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): string {
  const source = requireShotPlanRecord(
    input.session,
    input.command.shotPlanId
  );
  requireScene(input.session, source.sceneId);
  const sourceShots = listShotRecords(input.session, source.id);
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const shotPlanId = ids('shot_plan');
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    insertShotPlanRecord(session, {
      id: shotPlanId,
      sceneId: source.sceneId,
      title: source.title,
      coverage: parseStoredShotPlanCoverage(source.coverage, source.id),
      now: input.now,
    });
    const copiedShots = sourceShots.map((shot) => ({
      sourceShotId: shot.id,
      id: ids('shot'),
      title: shot.title,
      description: shot.description,
      brief: parseStoredShotBrief(shot.brief, shot.id),
    }));
    insertShotRecords(session, {
      shotPlanId,
      shots: copiedShots,
      now: input.now,
    });
    for (const copiedShot of copiedShots) {
      const representativeAssetId = readShotRepresentativeAssetId(
        session,
        copiedShot.sourceShotId
      );
      if (!representativeAssetId) {
        continue;
      }
      const sourceAsset = readAssetRelationship(session, {
        target: { kind: 'shot', shotId: copiedShot.sourceShotId },
        assetId: representativeAssetId,
      });
      if (!sourceAsset || sourceAsset.role !== 'shot-image') {
        throw new ProjectDataError(
          'CORE_SHOT_IMAGE_INVALID',
          `Shot ${copiedShot.sourceShotId} selects Asset ${representativeAssetId}, but it is not an active shot-image candidate.`
        );
      }
      insertAssetRelationshipRecord(
        session,
        { kind: 'shot', shotId: copiedShot.id },
        {
          relationshipId: ids('shot_asset'),
          assetId: sourceAsset.assetId,
          localeId: sourceAsset.localeId,
          role: sourceAsset.role,
          referenceName: sourceAsset.referenceName,
          purpose: sourceAsset.purpose,
          sortOrder: sourceAsset.sortOrder,
          now: input.now,
        }
      );
      writeShotRepresentativeAsset(session, {
        shotId: copiedShot.id,
        assetId: sourceAsset.assetId,
        now: input.now,
      });
    }
    if (source.lastGenerationSpecId !== null) {
      const generationSpecId = ids('media_generation_spec');
      copyGenerationSpecForAuthoring({
        sourceSpecId: source.lastGenerationSpecId,
        newSpecId: generationSpecId,
        authoredFrom: { kind: 'shotPlan', id: shotPlanId },
        session,
        now: input.now,
      });
      setShotPlanLastGenerationSpecId(session, {
        shotPlanId,
        lastGenerationSpecId: generationSpecId,
        now: input.now,
      });
    }
  });
  return shotPlanId;
}
