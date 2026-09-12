import { readShotPlanClips, createShotPlanClip, registerShotPlanClipTake, selectShotPlanClipTake, resolveShotPlanClipTake, updateShotPlanClipTake } from '../shot-plan-clips/commands.js';
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
  | 'readShotPlanClips'
  | 'createShotPlanClip'
  | 'registerShotPlanClipTake'
  | 'selectShotPlanClipTake'
  | 'resolveShotPlanClipTake'
  | 'updateShotPlanClipTake'
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
    readShotPlanClips,
    createShotPlanClip,
    registerShotPlanClipTake,
    selectShotPlanClipTake,
    resolveShotPlanClipTake,
    updateShotPlanClipTake,
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
