import type { ProjectDataService } from '../project-data-service-contracts.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { projectSceneShotPlanVideoGenerations } from '../shot-plan-video-generations/projection.js';

export function createShotPlanVideoGenerationServiceWiring(): Pick<
  ProjectDataService,
  'listSceneShotPlanVideoGenerations'
> {
  return {
    listSceneShotPlanVideoGenerations(input) {
      return withGenerationProject(input, ({ session }) =>
        projectSceneShotPlanVideoGenerations(session, input.sceneId)
      );
    },
  };
}
