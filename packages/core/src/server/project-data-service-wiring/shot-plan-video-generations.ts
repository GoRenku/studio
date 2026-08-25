import type { ProjectDataService } from '../project-data-service-contracts.js';
import { withProject } from '../project-operation.js';
import { projectSceneShotPlanVideoGenerations } from '../shot-plan-video-generations/projection.js';

export function createShotPlanVideoGenerationServiceWiring(): Pick<
  ProjectDataService,
  'listSceneShotPlanVideoGenerations'
> {
  return {
    listSceneShotPlanVideoGenerations(input) {
      return withProject(input, ({ session }) =>
        projectSceneShotPlanVideoGenerations(session, input.sceneId)
      );
    },
  };
}
