import { eq } from 'drizzle-orm';
import {
  allocateInitialProductionNumbers,
  productionNumberKey,
} from '../../client/production-numbers.js';
import type { ShotPlacement } from '../../client/shot-plans.js';
import { shotNumberReservations } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ShotRecord } from '../database/access/shot-plans/shot-records.js';
import { ProjectDataError } from '../project-data-error.js';
import { allocateProductionNumberOrThrow } from '../production-number-allocation.js';

export function reserveInitialShotNumbers(input: {
  session: DatabaseSession;
  shotPlanId: string;
  shots: Array<{ id: string }>;
  now: string;
}): string[] {
  const numbers = allocateInitialProductionNumbers(input.shots.length);
  input.shots.forEach((shot, index) => reserveShotNumber(input.session, {
    shotPlanId: input.shotPlanId,
    shotId: shot.id,
    number: numbers[index]!,
    now: input.now,
  }));
  return numbers;
}

export function allocateShotNumber(input: {
  session: DatabaseSession;
  shotPlanId: string;
  orderedShots: ShotRecord[];
  placement: ShotPlacement;
  shotId: string;
  now: string;
}): { number: string; index: number } {
  const index = placementIndex(input.orderedShots, input.placement);
  const reservedNumbers = input.session.db
    .select({ number: shotNumberReservations.number })
    .from(shotNumberReservations)
    .where(eq(shotNumberReservations.shotPlanId, input.shotPlanId))
    .all()
    .map((row) => row.number);
  const number = allocateProductionNumberOrThrow({
    orderedNumbers: input.orderedShots.map((shot) => shot.number),
    reservedNumbers,
    placement: index === input.orderedShots.length
      ? { position: 'end' }
      : { position: 'insert', index },
  });
  reserveShotNumber(input.session, {
    shotPlanId: input.shotPlanId,
    shotId: input.shotId,
    number,
    now: input.now,
  });
  return { number, index };
}

function reserveShotNumber(
  session: DatabaseSession,
  input: { shotPlanId: string; shotId: string; number: string; now: string }
): void {
  try {
    session.db.insert(shotNumberReservations).values({
      shotPlanId: input.shotPlanId,
      shotId: input.shotId,
      number: input.number,
      numberKey: productionNumberKey(input.number),
      createdAt: input.now,
    }).run();
  } catch {
    throw new ProjectDataError(
      'SHOT_NUMBER_RESERVATION_CONFLICT',
      `Shot number ${input.number} could not be reserved in Plan ${input.shotPlanId}.`
    );
  }
}

function placementIndex(shots: ShotRecord[], placement: ShotPlacement): number {
  if (placement.position === 'start') {
    return 0;
  }
  if (placement.position === 'end') {
    return shots.length;
  }
  if (!('shotId' in placement)) {
    return shots.length;
  }
  const index = shots.findIndex((shot) => shot.id === placement.shotId);
  if (index < 0 || shots[index]!.discardedAt) {
    throw new ProjectDataError(
      'SHOT_NUMBER_PLACEMENT_INVALID',
      `Shot placement target was not found in the active Plan: ${placement.shotId}.`
    );
  }
  return placement.position === 'before' ? index : index + 1;
}
