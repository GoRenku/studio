import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { ShotInput } from '../../../../client/shot-plans.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { shots } from '../../../schema/index.js';
import { serializeShotBrief } from '../../../shot-plans/validation.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export type ShotRecord = typeof shots.$inferSelect;

export function listShotRecords(
  session: DatabaseSession,
  shotPlanId: string
): ShotRecord[] {
  return session.db
    .select()
    .from(shots)
    .where(and(eq(shots.shotPlanId, shotPlanId), isNull(shots.discardedAt)))
    .orderBy(asc(shots.position), asc(shots.id))
    .all();
}

export function readShotRecord(
  session: DatabaseSession,
  shotId: string
): ShotRecord | null {
  return (
    session.db
      .select()
      .from(shots)
      .where(and(eq(shots.id, shotId), isNull(shots.discardedAt)))
      .get() ?? null
  );
}

export function requireShotRecord(
  session: DatabaseSession,
  shotId: string
): ShotRecord {
  const shot = readShotRecord(session, shotId);
  if (!shot) {
    throw new ProjectDataError(
      'CORE_SHOT_NOT_FOUND',
      `Shot was not found: ${shotId}.`
    );
  }
  return shot;
}

export function requireShotInPlan(
  session: DatabaseSession,
  input: { shotPlanId: string; shotId: string }
): ShotRecord {
  const shot = requireShotRecord(session, input.shotId);
  if (shot.shotPlanId !== input.shotPlanId) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_SHOT_MISMATCH',
      `Shot ${input.shotId} does not belong to Shot Plan ${input.shotPlanId}.`
    );
  }
  return shot;
}

export function insertShotRecords(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    shots: Array<ShotInput & { id: string; number: string }>;
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
        number: shot.number,
        title: shot.title,
        description: shot.description,
        brief: serializeShotBrief(shot.brief),
        createdAt: input.now,
        updatedAt: input.now,
      }))
    )
    .run();
}

export function insertShotRecord(
  session: DatabaseSession,
  input: {
    id: string;
    shotPlanId: string;
    shot: ShotInput;
    number: string;
    now: string;
  }
): void {
  const position =
    session.db
      .select({ value: sql<number | null>`max(${shots.position})` })
      .from(shots)
      .where(
        and(
          eq(shots.shotPlanId, input.shotPlanId),
          isNull(shots.discardedAt)
        )
      )
      .get()?.value ?? -1;
  session.db
    .insert(shots)
    .values({
      id: input.id,
      shotPlanId: input.shotPlanId,
      position: position + 1,
      number: input.number,
      title: input.shot.title,
      description: input.shot.description,
      brief: serializeShotBrief(input.shot.brief),
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function updateShotRecord(
  session: DatabaseSession,
  input: {
    shotId: string;
    shot: ShotInput;
    now: string;
  }
): void {
  session.db
    .update(shots)
    .set({
      title: input.shot.title,
      description: input.shot.description,
      brief: serializeShotBrief(input.shot.brief),
      updatedAt: input.now,
    })
    .where(eq(shots.id, input.shotId))
    .run();
}

export function discardShotRecord(
  session: DatabaseSession,
  input: {
    shotId: string;
    shotPlanId: string;
    operationId: string;
    now: string;
  }
): void {
  const parkedPosition =
    (session.db
      .select({ value: sql<number | null>`max(${shots.position})` })
      .from(shots)
      .where(eq(shots.shotPlanId, input.shotPlanId))
      .get()?.value ?? -1) + 1;
  session.db
    .update(shots)
    .set({
      position: parkedPosition,
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(shots.id, input.shotId),
        eq(shots.shotPlanId, input.shotPlanId)
      )
    )
    .run();
}

export function writeShotOrder(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    orderedShotIds: string[];
    now: string;
  }
): void {
  const discardedShotIds = session.db
    .select({ id: shots.id })
    .from(shots)
    .where(and(eq(shots.shotPlanId, input.shotPlanId), isNotNull(shots.discardedAt)))
    .orderBy(asc(shots.position), asc(shots.id))
    .all()
    .map((shot) => shot.id);
  const offset =
    (session.db
      .select({ value: sql<number | null>`max(${shots.position})` })
      .from(shots)
      .where(eq(shots.shotPlanId, input.shotPlanId))
      .get()?.value ?? -1) + 1;
  input.orderedShotIds.forEach((shotId, position) => {
    session.db
      .update(shots)
      .set({ position: position + offset })
      .where(
        and(eq(shots.id, shotId), eq(shots.shotPlanId, input.shotPlanId))
      )
      .run();
  });
  discardedShotIds.forEach((shotId, position) => {
    session.db
      .update(shots)
      .set({ position: offset + input.orderedShotIds.length + position })
      .where(and(eq(shots.id, shotId), eq(shots.shotPlanId, input.shotPlanId)))
      .run();
  });
  discardedShotIds.forEach((shotId, position) => {
    session.db
      .update(shots)
      .set({ position: input.orderedShotIds.length + position })
      .where(and(eq(shots.id, shotId), eq(shots.shotPlanId, input.shotPlanId)))
      .run();
  });
  input.orderedShotIds.forEach((shotId, position) => {
    session.db
      .update(shots)
      .set({ position, updatedAt: input.now })
      .where(
        and(eq(shots.id, shotId), eq(shots.shotPlanId, input.shotPlanId))
      )
      .run();
  });
}
