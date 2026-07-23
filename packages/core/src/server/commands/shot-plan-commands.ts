import type {
  CopyShotPlanInput,
  CreateShotPlanInput,
  DeleteShotPlanInput,
  ListSceneShotPlansInput,
  ReadShotPlanInput,
  SetShotPlanGenerationSpecInput,
  ShotPlanListReport,
  ShotPlanReport,
  UpdateShotPlanInput,
} from '../../client/shot-plans.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  associateShotPlanGenerationSpec,
  createShotPlanAuthoring,
  updateShotPlanAuthoring,
} from '../shot-plans/authoring.js';
import { copyShotPlanAuthoring } from '../shot-plans/copying.js';
import {
  projectSceneShotPlanListReport,
  projectShotPlanReport,
} from '../shot-plans/projection.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

export async function createShotPlan(
  input: CreateShotPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    const shotPlanId = createShotPlanAuthoring({
      command: input,
      session,
      now: new Date().toISOString(),
    });
    return projectShotPlanReport({ session, projectFolder, shotPlanId });
  });
}

export async function updateShotPlan(
  input: UpdateShotPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    updateShotPlanAuthoring({
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

export async function setShotPlanGenerationSpec(
  input: SetShotPlanGenerationSpecInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    associateShotPlanGenerationSpec({
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

export async function copyShotPlan(
  input: CopyShotPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    const shotPlanId = copyShotPlanAuthoring({
      command: input,
      session,
      now: new Date().toISOString(),
    });
    return projectShotPlanReport({ session, projectFolder, shotPlanId });
  });
}

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

export async function deleteShotPlan(
  input: DeleteShotPlanInput
): Promise<RecoverableMutationReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }
    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'shotPlan',
      itemId: input.shotPlanId,
      commandName: 'shotPlan.delete',
      changes: [
        { type: 'shotPlan.discarded', shotPlanId: input.shotPlanId },
      ],
    });
  });
}
