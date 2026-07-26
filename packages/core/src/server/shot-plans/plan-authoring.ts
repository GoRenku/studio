import type {
  CreateShotPlanInput,
  UpdateShotPlanDetailsInput,
} from '../../client/shot-plans.js';
import {
  insertShotPlanRecord,
  requireShotPlanRecord,
  updateShotPlanDetailsRecord,
} from '../database/access/shot-plans/plan-records.js';
import { insertShotRecords } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { requireScene } from './scene-ownership.js';
import {
  validateShotInput,
  validateShotPlanDetails,
} from './validation.js';

export function createShotPlanAuthoring(input: {
  command: CreateShotPlanInput;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): string {
  requireScene(input.session, input.command.sceneId);
  const details = validateShotPlanDetails(input.command);
  const authoredShots = input.command.shots.map((shot, index) =>
    validateShotInput(shot, ['shots', String(index)])
  );
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const shotPlanId = ids('shot_plan');
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    insertShotPlanRecord(session, {
      id: shotPlanId,
      sceneId: input.command.sceneId,
      title: details.title,
      coverage: details.coverage,
      now: input.now,
    });
    insertShotRecords(session, {
      shotPlanId,
      shots: authoredShots.map((shot) => ({
        ...shot,
        id: ids('shot'),
      })),
      now: input.now,
    });
  });
  return shotPlanId;
}

export function updateShotPlanDetailsAuthoring(input: {
  command: UpdateShotPlanDetailsInput;
  session: DatabaseSession;
  now: string;
}): void {
  const details = validateShotPlanDetails(input.command);
  requireShotPlanRecord(input.session, input.command.shotPlanId);
  updateShotPlanDetailsRecord(input.session, {
    shotPlanId: input.command.shotPlanId,
    title: details.title,
    coverage: details.coverage,
    now: input.now,
  });
}
