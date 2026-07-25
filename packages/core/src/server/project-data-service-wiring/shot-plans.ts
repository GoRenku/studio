import {
  copyShotPlan,
  createNextShotPlanGenerationSpec,
  createShotPlan,
  deleteShotPlan,
  listSceneShotPlans,
  readShotPlan,
  setShotPlanLastGenerationSpec,
  updateShotPlan,
} from '../commands/shot-plan-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createShotPlanServiceWiring(): Pick<
  ProjectDataService,
  | 'createShotPlan'
  | 'updateShotPlan'
  | 'setShotPlanLastGenerationSpec'
  | 'createNextShotPlanGenerationSpec'
  | 'copyShotPlan'
  | 'readShotPlan'
  | 'listSceneShotPlans'
  | 'deleteShotPlan'
> {
  return {
    createShotPlan,
    updateShotPlan,
    setShotPlanLastGenerationSpec,
    createNextShotPlanGenerationSpec,
    copyShotPlan,
    readShotPlan,
    listSceneShotPlans,
    deleteShotPlan,
  };
}
