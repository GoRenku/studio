import type {
  CreateShotPlanInput,
  SetShotPlanLastGenerationSpecInput,
  UpdateShotPlanInput,
} from '../../client/shot-plans.js';
import {
  insertShotPlanRecord,
  insertShotRecords,
  replaceShotPlanAuthoring,
  requireShotPlanRecord,
  setShotPlanLastGenerationSpecId,
} from '../database/access/shot-plans.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { readGenerationSpec } from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';
import { scenes } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import { validateShotPlanAuthoring } from './validation.js';

export function createShotPlanAuthoring(input: {
  command: CreateShotPlanInput;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): string {
  requireScene(input.session, input.command.sceneId);
  const authored = validateShotPlanAuthoring({
    ...input.command,
    allowShotIds: false,
  });
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const shotPlanId = ids('shot_plan');
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    insertShotPlanRecord(session, {
      id: shotPlanId,
      sceneId: input.command.sceneId,
      title: authored.title,
      coverage: authored.coverage,
      now: input.now,
    });
    insertShotRecords(session, {
      shotPlanId,
      shots: authored.shots.map((shot) => ({
        ...shot,
        id: ids('shot'),
      })),
      now: input.now,
    });
  });
  return shotPlanId;
}

export function updateShotPlanAuthoring(input: {
  command: UpdateShotPlanInput;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): void {
  const authored = validateShotPlanAuthoring({
    ...input.command,
    allowShotIds: true,
  });
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    requireShotPlanRecord(session, input.command.shotPlanId);
    replaceShotPlanAuthoring(session, {
      shotPlanId: input.command.shotPlanId,
      title: authored.title,
      coverage: authored.coverage,
      shots: authored.shots.map((shot) => ({
        ...shot,
        id: shot.id ?? ids('shot'),
        isNew: shot.id === undefined,
      })),
      now: input.now,
    });
  });
}

export function associateShotPlanLastGenerationSpec(input: {
  command: SetShotPlanLastGenerationSpecInput;
  session: DatabaseSession;
  now: string;
}): void {
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    const shotPlan = requireShotPlanRecord(
      session,
      input.command.shotPlanId
    );
    const spec = readGenerationSpec({
      id: input.command.lastGenerationSpecId,
      session,
    });
    if (
      spec.spec.purpose !== 'video.create' ||
      spec.spec.target.kind !== 'project' ||
      spec.spec.authoredFrom?.kind !== 'shotPlan' ||
      spec.spec.authoredFrom.id !== shotPlan.id
    ) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_GENERATION_SPEC_INVALID',
        `Generation Spec ${spec.id} is not authored from Shot Plan ${shotPlan.id}.`
      );
    }
    setShotPlanLastGenerationSpecId(session, {
      shotPlanId: shotPlan.id,
      lastGenerationSpecId: input.command.lastGenerationSpecId,
      now: input.now,
    });
  });
}

export function requireScene(session: DatabaseSession, sceneId: string): void {
  const scene = session.db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .get();
  if (!scene) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_SCENE_NOT_FOUND',
      `Scene was not found: ${sceneId}.`
    );
  }
}
