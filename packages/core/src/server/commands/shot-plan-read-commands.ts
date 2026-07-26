import type {
  ListSceneShotPlansInput,
  ReadShotPlanInput,
  ShotPlanListReport,
  ShotPlanReport,
} from '../../client/shot-plans.js';
import { withGenerationProject } from '../generation/project-operation.js';
import {
  projectSceneShotPlanListReport,
  projectShotPlanReport,
} from '../shot-plans/projection.js';

export async function readShotPlan(
  input: ReadShotPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) =>
    projectShotPlanReport({
      session,
      projectFolder,
      shotPlanId: input.shotPlanId,
    })
  );
}

export async function listSceneShotPlans(
  input: ListSceneShotPlansInput
): Promise<ShotPlanListReport> {
  return withGenerationProject(input, ({ session, projectFolder }) =>
    projectSceneShotPlanListReport({
      session,
      projectFolder,
      sceneId: input.sceneId,
    })
  );
}
