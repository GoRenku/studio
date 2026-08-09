import type { ProjectRelativePath } from '../../../client/index.js';
import { requireShotPlanRecord } from '../../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireSceneStorageContext } from '../owner-lookups.js';

export interface ShotPlanStorageContext {
  scenePathSegment: string;
  shotPlanNumber: number;
  shotPlanDisplayNumber: string;
  root: ProjectRelativePath;
}

export function requireShotPlanStorageContext(
  session: DatabaseSession,
  shotPlanId: string
): ShotPlanStorageContext {
  const shotPlan = requireShotPlanRecord(session, shotPlanId);
  const scene = requireSceneStorageContext(session, shotPlan.sceneId);
  const shotPlanDisplayNumber = String(shotPlan.number).padStart(2, '0');
  return {
    scenePathSegment: scene.pathSegment,
    shotPlanNumber: shotPlan.number,
    shotPlanDisplayNumber,
    root: joinProjectRelativePath(
      'scenes',
      scene.pathSegment,
      `${shotPlanDisplayNumber}-shot-plan`
    ),
  };
}
