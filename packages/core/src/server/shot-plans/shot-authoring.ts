import type {
  AddShotToPlanInput,
  MoveShotInPlanInput,
  UpdateShotInPlanInput,
} from '../../client/shot-plans.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import {
  insertShotRecord,
  listShotRecords,
  requireShotInPlan,
  updateShotRecord,
  writeShotOrder,
} from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { validateShotInput } from './validation.js';

export function addShotAuthoring(input: {
  command: AddShotToPlanInput;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): string {
  requireShotPlanRecord(input.session, input.command.shotPlanId);
  const shot = validateShotInput(input.command.shot, ['shot']);
  const shotId = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  )('shot');
  insertShotRecord(input.session, {
    id: shotId,
    shotPlanId: input.command.shotPlanId,
    shot,
    now: input.now,
  });
  return shotId;
}

export function updateShotAuthoring(input: {
  command: UpdateShotInPlanInput;
  session: DatabaseSession;
  now: string;
}): void {
  requireShotPlanRecord(input.session, input.command.shotPlanId);
  requireShotInPlan(input.session, input.command);
  const shot = validateShotInput(input.command.shot, ['shot']);
  updateShotRecord(input.session, {
    shotId: input.command.shotId,
    shot,
    now: input.now,
  });
}

export function moveShotAuthoring(input: {
  command: MoveShotInPlanInput;
  session: DatabaseSession;
  now: string;
}): void {
  requireShotPlanRecord(input.session, input.command.shotPlanId);
  requireShotInPlan(input.session, input.command);
  const records = listShotRecords(input.session, input.command.shotPlanId);
  if (
    !Number.isInteger(input.command.position) ||
    input.command.position < 0 ||
    input.command.position >= records.length
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_INVALID',
      `Shot position must be an integer from 0 to ${Math.max(
        0,
        records.length - 1
      )}.`
    );
  }
  const orderedIds = records
    .filter((shot) => shot.id !== input.command.shotId)
    .map((shot) => shot.id);
  orderedIds.splice(input.command.position, 0, input.command.shotId);
  writeShotOrder(input.session, {
    shotPlanId: input.command.shotPlanId,
    orderedShotIds: orderedIds,
    now: input.now,
  });
}
