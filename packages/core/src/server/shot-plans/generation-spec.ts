import {
  requireShotPlanRecord,
  setShotPlanLastGenerationSpecId,
} from '../database/access/shot-plans/plan-records.js';
import type { SetShotPlanLastGenerationSpecInput } from '../../client/shot-plans.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import {
  copyGenerationSpecForAuthoring,
  readGenerationSpec,
} from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';

export function createNextShotPlanGenerationSpecAuthoring(input: {
  shotPlanId: string;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): string {
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const generationSpecId = ids('media_generation_spec');
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    const shotPlan = requireShotPlanRecord(session, input.shotPlanId);
    if (shotPlan.lastGenerationSpecId === null) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_GENERATION_SPEC_MISSING',
        `Shot Plan has no last Generation Spec to copy: ${shotPlan.id}.`
      );
    }
    const lastSpec = readGenerationSpec({
      id: shotPlan.lastGenerationSpecId,
      session,
    });
    if (lastSpec.frozenAt === null) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_GENERATION_SPEC_MUTABLE',
        `The last Generation Spec for Shot Plan ${shotPlan.id} can still be edited.`,
        {
          suggestion:
            'Edit the existing Generation Spec instead of creating another copy.',
        }
      );
    }
    copyGenerationSpecForAuthoring({
      sourceSpecId: lastSpec.id,
      newSpecId: generationSpecId,
      authoredFrom: { kind: 'shotPlan', id: shotPlan.id },
      session,
      now: input.now,
    });
    setShotPlanLastGenerationSpecId(session, {
      shotPlanId: shotPlan.id,
      lastGenerationSpecId: generationSpecId,
      now: input.now,
    });
  });
  return generationSpecId;
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
