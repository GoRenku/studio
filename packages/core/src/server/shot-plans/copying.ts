import type { CopyShotPlanInput } from '../../client/shot-plans.js';
import {
  insertShotPlanRecord,
  requireShotPlanRecord,
} from '../database/access/shot-plans/plan-records.js';
import {
  insertShotRecords,
  listShotRecords,
} from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { parseStoredShotBrief, parseStoredShotPlanCoverage } from './validation.js';
import { requireScene } from './scene-ownership.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
import { copySelectedShotImage } from './image-copying.js';
import { allocateShotPlanNumber } from './plan-numbering.js';
import { reserveInitialShotNumbers } from './shot-numbering.js';

export function copyShotPlanAuthoring(input: {
  command: CopyShotPlanInput;
  session: DatabaseSession;
  projectFolder: string;
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
  const writeSet = createProjectAssetFileWriteSet({
    projectFolder: input.projectFolder,
  });
  try {
    input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      const number = allocateShotPlanNumber(session, source.sceneId);
      insertShotPlanRecord(session, {
        id: shotPlanId,
        sceneId: source.sceneId,
        number,
        title: source.title,
        coverage: parseStoredShotPlanCoverage(source.coverage, source.id),
        now: input.now,
      });
      const copiedShots = sourceShots.map((shot) => ({
        sourceShotId: shot.id,
        id: ids('shot'),
        title: shot.title,
        description: shot.description,
        brief: parseStoredShotBrief(shot.brief, shot.id),
      }));
      const numbers = reserveInitialShotNumbers({
        session,
        shotPlanId,
        shots: copiedShots,
        now: input.now,
      });
      insertShotRecords(session, {
        shotPlanId,
        shots: copiedShots.map((shot, index) => ({
          ...shot,
          number: numbers[index]!,
        })),
        now: input.now,
      });
      for (const copiedShot of copiedShots) {
        copySelectedShotImage({
          session,
          projectFolder: input.projectFolder,
          writeSet,
          sourceShotId: copiedShot.sourceShotId,
          destinationShotId: copiedShot.id,
          destinationShotPlanId: shotPlanId,
          ids,
          now: input.now,
        });
      }
    });
    commitProjectAssetFileWriteSet(writeSet);
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  return shotPlanId;
}
