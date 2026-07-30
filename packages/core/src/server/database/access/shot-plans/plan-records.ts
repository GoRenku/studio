import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ShotPlanCoverage } from '../../../../client/shot-plans.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { shotPlans } from '../../../schema/index.js';
import { serializeShotPlanCoverage } from '../../../shot-plans/validation.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export type ShotPlanRecord = typeof shotPlans.$inferSelect;

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

export function insertShotPlanRecord(
  session: DatabaseSession,
  input: {
    id: string;
    sceneId: string;
    title: string;
    coverage: ShotPlanCoverage | null;
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

export function updateShotPlanDetailsRecord(
  session: DatabaseSession,
  input: {
    shotPlanId: string;
    title: string;
    coverage: ShotPlanCoverage | null;
    now: string;
  }
): void {
  session.db
    .update(shotPlans)
    .set({
      title: input.title,
      coverage: serializeShotPlanCoverage(input.coverage),
      updatedAt: input.now,
    })
    .where(eq(shotPlans.id, input.shotPlanId))
    .run();
}
