import {
  addShotToPlan,
  copyShotPlan,
  createShotPlan,
  deleteShotPlan,
  moveShotInPlan,
  removeShotFromPlan,
  updateShotInPlan,
  updateShotPlanDetails,
} from '../commands/shot-plan-authoring-commands.js';
import {
  createNextShotPlanGenerationSpec,
  setShotPlanLastGenerationSpec,
} from '../commands/shot-plan-generation-commands.js';
import {
  listSceneShotPlans,
  readShotPlan,
} from '../commands/shot-plan-read-commands.js';
import {
  clearShotRepresentativeImage,
  discardShotImageCandidate,
  setShotRepresentativeImage,
} from '../commands/shot-image-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';
import { validateShotPlanDocument } from '../shot-plans/validation.js';

export function createShotPlanServiceWiring(): Pick<
  ProjectDataService,
  | 'createShotPlan'
  | 'validateShotPlanDocument'
  | 'updateShotPlanDetails'
  | 'addShotToPlan'
  | 'updateShotInPlan'
  | 'moveShotInPlan'
  | 'removeShotFromPlan'
  | 'setShotPlanLastGenerationSpec'
  | 'createNextShotPlanGenerationSpec'
  | 'copyShotPlan'
  | 'readShotPlan'
  | 'listSceneShotPlans'
  | 'deleteShotPlan'
  | 'setShotRepresentativeImage'
  | 'clearShotRepresentativeImage'
  | 'discardShotImageCandidate'
> {
  return {
    createShotPlan,
    async validateShotPlanDocument(input) {
      return validateShotPlanDocument(input.document);
    },
    updateShotPlanDetails,
    addShotToPlan,
    updateShotInPlan,
    moveShotInPlan,
    removeShotFromPlan,
    setShotPlanLastGenerationSpec,
    createNextShotPlanGenerationSpec,
    copyShotPlan,
    readShotPlan,
    listSceneShotPlans,
    deleteShotPlan,
    setShotRepresentativeImage,
    clearShotRepresentativeImage,
    discardShotImageCandidate,
  };
}
