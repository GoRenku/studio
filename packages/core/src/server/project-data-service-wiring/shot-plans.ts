import { readShotPlanPrevis, registerShotPlanPrevis } from '../shot-plan-previs/registration.js';
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
  listSceneShotPlans,
  readShotPlan,
} from '../commands/shot-plan-read-commands.js';
import { discardShotImageCandidate } from '../commands/shot-image-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';
import { validateShotPlanDocument } from '../shot-plans/validation.js';
import {
  discardShotPlanImageAsset,
  readShotPlanImageAssets,
} from '../shot-plan-image-assets/index.js';

export function createShotPlanServiceWiring(): Pick<
  ProjectDataService,
  | 'readShotPlanPrevis'
  | 'registerShotPlanPrevis'
  | 'createShotPlan'
  | 'validateShotPlanDocument'
  | 'updateShotPlanDetails'
  | 'addShotToPlan'
  | 'updateShotInPlan'
  | 'moveShotInPlan'
  | 'removeShotFromPlan'
  | 'copyShotPlan'
  | 'readShotPlan'
  | 'listSceneShotPlans'
  | 'deleteShotPlan'
  | 'discardShotImageCandidate'
  | 'readShotPlanImageAssets'
  | 'discardShotPlanImageAsset'
> {
  return {
    readShotPlanPrevis,
    registerShotPlanPrevis,
    createShotPlan,
    async validateShotPlanDocument(input) {
      return validateShotPlanDocument(input.document);
    },
    updateShotPlanDetails,
    addShotToPlan,
    updateShotInPlan,
    moveShotInPlan,
    removeShotFromPlan,
    copyShotPlan,
    readShotPlan,
    listSceneShotPlans,
    deleteShotPlan,
    discardShotImageCandidate,
    readShotPlanImageAssets,
    discardShotPlanImageAsset,
  };
}
