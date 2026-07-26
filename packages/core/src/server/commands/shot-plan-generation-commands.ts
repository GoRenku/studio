import type {
  CreateNextShotPlanGenerationSpecInput,
  SetShotPlanLastGenerationSpecInput,
  ShotPlanReport,
} from '../../client/shot-plans.js';
import { withGenerationProject } from '../generation/project-operation.js';
import {
  associateShotPlanLastGenerationSpec,
  createNextShotPlanGenerationSpecAuthoring,
} from '../shot-plans/generation-spec.js';
import { projectShotPlanReport } from '../shot-plans/projection.js';

export async function setShotPlanLastGenerationSpec(
  input: SetShotPlanLastGenerationSpecInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    associateShotPlanLastGenerationSpec({
      command: input,
      session,
      now: new Date().toISOString(),
    });
    return projectShotPlanReport({
      session,
      projectFolder,
      shotPlanId: input.shotPlanId,
    });
  });
}

export async function createNextShotPlanGenerationSpec(
  input: CreateNextShotPlanGenerationSpecInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    createNextShotPlanGenerationSpecAuthoring({
      shotPlanId: input.shotPlanId,
      session,
      now: new Date().toISOString(),
    });
    return projectShotPlanReport({
      session,
      projectFolder,
      shotPlanId: input.shotPlanId,
    });
  });
}
