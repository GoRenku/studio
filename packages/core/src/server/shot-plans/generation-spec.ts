import {
  requireShotPlanRecord,
  setShotPlanLastGenerationSpecId,
} from '../database/access/shot-plans.js';
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
