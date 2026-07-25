import type { CopyShotPlanInput } from '../../client/shot-plans.js';
import {
  insertShotPlanRecord,
  insertShotRecords,
  listShotRecords,
  requireShotPlanRecord,
  setShotPlanLastGenerationSpecId,
} from '../database/access/shot-plans.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { copyGenerationSpecForAuthoring } from '../generation/specs.js';
import { parseStoredShotBrief, parseStoredShotPlanCoverage } from './validation.js';
import { requireScene } from './authoring.js';

export function copyShotPlanAuthoring(input: {
  command: CopyShotPlanInput;
  session: DatabaseSession;
  idGenerator?: ProjectIdGenerator;
  now: string;
}): string {
  const source = requireShotPlanRecord(
    input.session,
    input.command.shotPlanId
  );
  requireScene(input.session, source.sceneId);
  const sourceShots = listShotRecords(input.session, source.id);
  const ids = createUniqueIdAllocator(
    input.idGenerator ?? createRandomIdGenerator()
  );
  const shotPlanId = ids('shot_plan');
  input.session.db.transaction((tx) => {
    const session = { ...input.session, db: tx };
    insertShotPlanRecord(session, {
      id: shotPlanId,
      sceneId: source.sceneId,
      title: source.title,
      coverage: parseStoredShotPlanCoverage(source.coverage, source.id),
      now: input.now,
    });
    insertShotRecords(session, {
      shotPlanId,
      shots: sourceShots.map((shot) => ({
        id: ids('shot'),
        description: shot.description,
        brief: parseStoredShotBrief(shot.brief, shot.id),
      })),
      now: input.now,
    });
    if (source.lastGenerationSpecId !== null) {
      const generationSpecId = ids('media_generation_spec');
      copyGenerationSpecForAuthoring({
        sourceSpecId: source.lastGenerationSpecId,
        newSpecId: generationSpecId,
        authoredFrom: { kind: 'shotPlan', id: shotPlanId },
        session,
        now: input.now,
      });
      setShotPlanLastGenerationSpecId(session, {
        shotPlanId,
        lastGenerationSpecId: generationSpecId,
        now: input.now,
      });
    }
  });
  return shotPlanId;
}
