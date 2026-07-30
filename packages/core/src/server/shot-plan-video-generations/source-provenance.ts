import type { GenerationSpec } from '../../client/generation.js';
import type { Asset } from '../../client/assets.js';
import { readAssetFileGenerationRecord } from '../database/access/asset-file-generations.js';
import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import { readAssetRecord } from '../database/access/assets.js';
import {
  readGenerationRunRecord,
  readGenerationSpecRecord,
} from '../database/access/media-generation.js';
import { readShotPlanRecordIncludingDiscarded } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { and, eq, isNull } from 'drizzle-orm';
import { assetFiles, trashItems } from '../schema/index.js';
import { studioSceneVideoGenerationsResourceKey } from '../studio-coordination/resource-keys.js';

export function readShotPlanVideoSourceSpec(
  session: DatabaseSession,
  asset: Asset,
): GenerationSpec | null {
  return readShotPlanVideoSourceSpecForFiles(
    session,
    asset.files.map((file) => ({
      assetId: asset.id,
      assetFileId: file.id,
    })),
  );
}

export function shotPlanVideoAssetResourceKeys(
  session: DatabaseSession,
  assetId: string,
): string[] {
  const asset = readAssetRecord(session, assetId);
  if (
    asset?.type !== 'shot_plan_video'
    || asset.mediaKind !== 'video'
    || readAssetMembershipRecord(session, assetId)?.ownerKey !== 'project'
  ) {
    return [];
  }
  const files = session.db
    .select({ assetId: assetFiles.assetId, assetFileId: assetFiles.id })
    .from(assetFiles)
    .where(eq(assetFiles.assetId, assetId))
    .all();
  const spec = readShotPlanVideoSourceSpecForFiles(session, files);
  const sceneId = spec ? shotPlanVideoSourceSceneId(session, spec) : null;
  return sceneId ? [studioSceneVideoGenerationsResourceKey(sceneId)] : [];
}

export function shotPlanVideoSourceSceneId(
  session: DatabaseSession,
  spec: GenerationSpec,
): string | null {
  const shotPlanId = isShotPlanVideoSpec(spec)
    ? spec.authoredFrom.id
    : null;
  const shotPlan = shotPlanId
    ? readShotPlanRecordIncludingDiscarded(session, shotPlanId)
    : null;
  if (!shotPlan) {
    return null;
  }
  if (!shotPlan.discardedAt) {
    return shotPlan.sceneId;
  }
  const activeTrashItem = session.db
    .select({ id: trashItems.id })
    .from(trashItems)
    .where(and(
      eq(trashItems.itemKind, 'shotPlan'),
      eq(trashItems.itemId, shotPlan.id),
      eq(trashItems.ownerKind, 'scene'),
      eq(trashItems.ownerId, shotPlan.sceneId),
      isNull(trashItems.restoredAt),
      isNull(trashItems.garbageCollectedAt),
    ))
    .get();
  return activeTrashItem ? shotPlan.sceneId : null;
}

function readShotPlanVideoSourceSpecForFiles(
  session: DatabaseSession,
  files: Array<{ assetId: string; assetFileId: string }>,
): GenerationSpec | null {
  for (const file of files) {
    const managedGeneration = readAssetFileGenerationRecord(
      session,
      file.assetFileId,
    );
    if (managedGeneration) {
      const spec = readGenerationRunRecord(
        session,
        managedGeneration.mediaGenerationRunId,
      )?.specSnapshot;
      if (isShotPlanVideoSpec(spec)) {
        return spec;
      }
      continue;
    }

    const sourceGenerationSpecId = readSourceGenerationSpecId(
      session,
      file.assetId,
      file.assetFileId,
    );
    if (!sourceGenerationSpecId) {
      continue;
    }
    const record = readGenerationSpecRecord(session, sourceGenerationSpecId);
    if (record?.frozenAt && isShotPlanVideoSpec(record.spec)) {
      return record.spec;
    }
  }
  return null;
}

function readSourceGenerationSpecId(
  session: DatabaseSession,
  assetId: string,
  assetFileId: string,
): string | null {
  return readAssetFileRecordIncludingDiscarded(session, {
    assetId,
    assetFileId,
  })?.sourceGenerationSpecId ?? null;
}

function isShotPlanVideoSpec(
  spec: GenerationSpec | null | undefined,
): spec is GenerationSpec & {
  purpose: 'shot-plan.video-generation';
  authoredFrom: { kind: 'shotPlan'; id: string };
} {
  return spec?.purpose === 'shot-plan.video-generation'
    && spec.authoredFrom?.kind === 'shotPlan'
    && spec.authoredFrom.id.trim().length > 0;
}
