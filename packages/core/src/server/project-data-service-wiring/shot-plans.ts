import {
  copyShotPlan,
  createShotPlan,
  deleteShotPlan,
  listSceneShotPlans,
  readShotPlan,
  setShotPlanGenerationSpec,
  updateShotPlan,
} from '../commands/shot-plan-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createShotPlanServiceWiring(): Pick<
  ProjectDataService,
  | 'createShotPlan'
  | 'updateShotPlan'
  | 'setShotPlanGenerationSpec'
  | 'copyShotPlan'
  | 'readShotPlan'
  | 'listSceneShotPlans'
  | 'deleteShotPlan'
> {
  return {
    createShotPlan,
    updateShotPlan,
    setShotPlanGenerationSpec,
    copyShotPlan,
    readShotPlan,
    listSceneShotPlans,
    deleteShotPlan,
  };
}
