import type { ScreenplayDocument } from '../../client/screenplay.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  planSceneProductionNumberAllocations,
  screenplaySceneIds,
  type SceneProductionNumberAllocation,
} from './allocation.js';
import {
  insertSceneProductionNumberAllocations,
  listSceneProductionNumberReservations,
} from './persistence.js';

export function planScreenplaySceneProductionNumbers(input: {
  session: DatabaseSession;
  before: ScreenplayDocument | null;
  after: ScreenplayDocument;
}): SceneProductionNumberAllocation[] {
  return planSceneProductionNumberAllocations({
    beforeSceneIds: screenplaySceneIds(input.before),
    afterSceneIds: screenplaySceneIds(input.after),
    reservations: listSceneProductionNumberReservations(input.session),
  });
}

export function applyScreenplaySceneProductionNumbers(input: {
  session: DatabaseSession;
  allocations: SceneProductionNumberAllocation[];
}): void {
  insertSceneProductionNumberAllocations(input.session, input.allocations);
}
