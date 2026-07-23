import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { ShotInput } from '../../../client/shot-plans.js';
import { ProjectDataError } from '../../project-data-error.js';
import { shotPlans, shots } from '../../schema/index.js';
import {
  serializeShotBrief,
  serializeShotPlanCoverage,
} from '../../shot-plans/validation.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ShotPlanRecord = typeof shotPlans.$inferSelect;
export type ShotRecord = typeof shots.$inferSelect;

export function readShotPlanRecord(
  session: DatabaseSession,
  shotPlanId: string
): ShotPlanRecord | null {
  return (
    session.db
      .select()
      .from(shotPlans)
      .where(and(eq(shotPlans.id, shotPlanId), isNull(shotPlans.discardedAt)))
      .get() ?? null
  );
}

export function readShotPlanRecordIncludingDiscarded(
  session: DatabaseSession,
  shotPlanId: string
): ShotPlanRecord | null {
  return (
    session.db
      .select()
      .from(shotPlans)
      .where(eq(shotPlans.id, shotPlanId))
      .get() ?? null
  );
}

export function requireShotPlanRecord(
  session: DatabaseSession,
  shotPlanId: string
): ShotPlanRecord {
  const record = readShotPlanRecord(session, shotPlanId);
  if (!record) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_NOT_FOUND',
      `Shot Plan was not found: ${shotPlanId}.`
    );
  }
  return record;
}

export function listSceneShotPlanRecords(
  session: DatabaseSession,
  sceneId: string
): ShotPlanRecord[] {
  return session.db
    .select()
    .from(shotPlans)
    .where(and(eq(shotPlans.sceneId, sceneId), isNull(shotPlans.discardedAt)))
    .orderBy(asc(shotPlans.createdAt), asc(shotPlans.id))
    .all();
}

export function listShotRecords(
  session: DatabaseSession,
  shotPlanId: string
): ShotRecord[] {
  return session.db
    .select()
    .from(shots)
    .where(eq(shots.shotPlanId, shotPlanId))
    .orderBy(asc(shots.position), asc(shots.id))
    .all();
}

export function insertShotPlanRecord(
  session: DatabaseSession,
  input: {
    id: string;
    sceneId: string;
    title: string;
    coverage: import('../../../client/shot-plans.js').ShotPlanCoverage | null;
    now: string;
  }
): void {
  session.db
    .insert(shotPlans)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      title: input.title,
      coverage: serializeShotPlanCoverage(input.coverage),
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function insertShotRecords(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    shots: Array<ShotInput & { id: string }>;
    now: string;
  }
): void {
  if (input.shots.length === 0) {
    return;
  }
  session.db
    .insert(shots)
    .values(
      input.shots.map((shot, position) => ({
        id: shot.id,
        shotPlanId: input.shotPlanId,
        position,
        description: shot.description,
        brief: serializeShotBrief(shot.brief),
        createdAt: input.now,
        updatedAt: input.now,
      }))
    )
    .run();
}

export function replaceShotPlanAuthoring(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    title: string;
    coverage: import('../../../client/shot-plans.js').ShotPlanCoverage | null;
    shots: Array<ShotInput & { id: string; isNew: boolean }>;
    now: string;
  }
): void {
  const current = listShotRecords(session, input.shotPlanId);
  const currentById = new Map(current.map((shot) => [shot.id, shot]));
  const submittedExistingIds = new Set(
    input.shots.filter((shot) => !shot.isNew).map((shot) => shot.id)
  );
  const unknownIds = input.shots
    .filter((shot) => !shot.isNew)
    .map((shot) => shot.id)
    .filter((id) => !currentById.has(id));
  if (unknownIds.length > 0) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_INVALID',
      `Submitted Shot ids do not belong to Shot Plan ${input.shotPlanId}: ${unknownIds.join(
        ', '
      )}.`
    );
  }

  session.db
    .update(shotPlans)
    .set({
      title: input.title,
      coverage: serializeShotPlanCoverage(input.coverage),
      updatedAt: input.now,
    })
    .where(eq(shotPlans.id, input.shotPlanId))
    .run();

  const positionOffset =
    Math.max(-1, ...current.map((shot) => shot.position)) +
    input.shots.length +
    1;
  current.forEach((shot) => {
    session.db
      .update(shots)
      .set({ position: shot.position + positionOffset })
      .where(eq(shots.id, shot.id))
      .run();
  });

  input.shots.forEach((shot, position) => {
    if (shot.isNew) {
      session.db
        .insert(shots)
        .values({
          id: shot.id,
          shotPlanId: input.shotPlanId,
          position,
          description: shot.description,
          brief: serializeShotBrief(shot.brief),
          createdAt: input.now,
          updatedAt: input.now,
        })
        .run();
    } else {
      session.db
        .update(shots)
        .set({
          position,
          description: shot.description,
          brief: serializeShotBrief(shot.brief),
          updatedAt: input.now,
        })
        .where(eq(shots.id, shot.id))
        .run();
    }
  });

  const omittedIds = current
    .map((shot) => shot.id)
    .filter((id) => !submittedExistingIds.has(id));
  if (omittedIds.length > 0) {
    session.db.delete(shots).where(inArray(shots.id, omittedIds)).run();
  }
}

export function setShotPlanGenerationSpecId(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    generationSpecId: string | null;
    now: string;
  }
): void {
  session.db
    .update(shotPlans)
    .set({
      generationSpecId: input.generationSpecId,
      updatedAt: input.now,
    })
    .where(eq(shotPlans.id, input.shotPlanId))
    .run();
}

export function attachShotPlanVideoAsset(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    videoAssetId: string;
    now: string;
  }
): void {
  session.db
    .update(shotPlans)
    .set({
      videoAssetId: input.videoAssetId,
      videoAttachedAt: input.now,
      updatedAt: input.now,
    })
    .where(eq(shotPlans.id, input.shotPlanId))
    .run();
}
