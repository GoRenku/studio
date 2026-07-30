import type {
  AddShotToPlanInput,
  CopyShotPlanInput,
  CreateShotPlanInput,
  DeleteShotPlanInput,
  MoveShotInPlanInput,
  RemoveShotFromPlanInput,
  ShotPlanReport,
  UpdateShotInPlanInput,
  UpdateShotPlanDetailsInput,
} from '../../client/shot-plans.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { requireShotInPlan } from '../database/access/shot-plans/shot-records.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { copyShotPlanAuthoring } from '../shot-plans/copying.js';
import {
  createShotPlanAuthoring,
  updateShotPlanDetailsAuthoring,
} from '../shot-plans/plan-authoring.js';
import { projectShotPlanReport } from '../shot-plans/projection.js';
import {
  addShotAuthoring,
  moveShotAuthoring,
  updateShotAuthoring,
} from '../shot-plans/shot-authoring.js';
import {
  studioSceneShotPlansResourceKey,
  studioSceneVideoGenerationsResourceKey,
} from '../studio-coordination/resource-keys.js';
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

export async function updateShotPlanDetails(
  input: UpdateShotPlanDetailsInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    updateShotPlanDetailsAuthoring({
      command: input,
      session,
      now: new Date().toISOString(),
    });
    const report = projectShotPlanReport({
      session,
      projectFolder,
      shotPlanId: input.shotPlanId,
    });
    return {
      ...report,
      resourceKeys: [
        ...report.resourceKeys,
        studioSceneVideoGenerationsResourceKey(report.shotPlan.sceneId),
      ],
    };
  });
}

export async function addShotToPlan(
  input: AddShotToPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    addShotAuthoring({
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

export async function updateShotInPlan(
  input: UpdateShotInPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    updateShotAuthoring({
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

export async function moveShotInPlan(
  input: MoveShotInPlanInput
): Promise<ShotPlanReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    moveShotAuthoring({
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

export async function removeShotFromPlan(
  input: RemoveShotFromPlanInput
): Promise<RecoverableMutationReport> {
  return withGenerationProject(input, ({ session, projectFolder }) => {
    const plan = requireShotPlanRecord(session, input.shotPlanId);
    requireShotInPlan(session, input);
    return discardShotPlanObject({
      session,
      projectFolder,
      itemKind: 'shot',
      itemId: input.shotId,
      commandName: 'shotPlan.shot.remove',
      changes: [{ type: 'shot.removed', shotId: input.shotId }],
      resourceKeys: [
        studioSceneShotPlansResourceKey(plan.sceneId),
      ],
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
      projectFolder,
      now: new Date().toISOString(),
    });
    return projectShotPlanReport({ session, projectFolder, shotPlanId });
  });
}

export async function deleteShotPlan(
  input: DeleteShotPlanInput
): Promise<RecoverableMutationReport> {
  return withGenerationProject(input, ({ session, projectFolder }) =>
    discardShotPlanObject({
      session,
      projectFolder,
      itemKind: 'shotPlan',
      itemId: input.shotPlanId,
      commandName: 'shotPlan.delete',
      changes: [
        { type: 'shotPlan.discarded', shotPlanId: input.shotPlanId },
      ],
    })
  );
}

function discardShotPlanObject(
  input: Omit<
    Parameters<typeof discardTrashObject>[0],
    'project'
  >
): RecoverableMutationReport {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${input.session.databasePath}.`
    );
  }
  return discardTrashObject({ ...input, project });
}
