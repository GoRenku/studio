import { eq, sql } from 'drizzle-orm';
import { sceneShotPlanNumbers } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export function allocateShotPlanNumber(
  session: DatabaseSession,
  sceneId: string
): number {
  session.db.insert(sceneShotPlanNumbers).values({
    sceneId,
    lastNumber: 1,
  }).onConflictDoUpdate({
    target: sceneShotPlanNumbers.sceneId,
    set: { lastNumber: sql`${sceneShotPlanNumbers.lastNumber} + 1` },
  }).run();
  const number = session.db.select({ value: sceneShotPlanNumbers.lastNumber })
    .from(sceneShotPlanNumbers)
    .where(eq(sceneShotPlanNumbers.sceneId, sceneId))
    .get()?.value;
  if (!number) {
    throw new ProjectDataError(
      'SHOT_PLAN_NUMBER_ALLOCATION_FAILED',
      `Shot Plan number could not be allocated for Scene ${sceneId}.`
    );
  }
  return number;
}
