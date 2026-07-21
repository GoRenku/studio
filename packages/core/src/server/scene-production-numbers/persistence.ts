import { asc } from 'drizzle-orm';
import { sceneProductionNumbers } from '../schema/scene-production-numbers.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  SceneProductionNumberAllocation,
  SceneProductionNumberReservation,
} from './allocation.js';

export function listSceneProductionNumberReservations(
  session: DatabaseSession
): SceneProductionNumberReservation[] {
  return session.db
    .select({
      productionNumber: sceneProductionNumbers.productionNumber,
      sceneId: sceneProductionNumbers.sceneId,
    })
    .from(sceneProductionNumbers)
    .orderBy(asc(sceneProductionNumbers.productionNumber))
    .all();
}

export function insertSceneProductionNumberAllocations(
  session: DatabaseSession,
  allocations: SceneProductionNumberAllocation[]
): void {
  if (allocations.length === 0) {
    return;
  }
  session.db.insert(sceneProductionNumbers).values(allocations).run();
}
