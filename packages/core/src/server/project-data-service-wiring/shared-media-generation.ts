import * as sharedGeneration from '../media-generation/shared-generation-service.js';
import * as costEstimation from '../media-generation/cost/spec-estimates.js';
import * as lifecycleEstimation from '../media-generation/lifecycle/spec-estimates.js';

export function createSharedMediaGenerationServiceWiring() {
  return {
    buildMediaGenerationContext: sharedGeneration.buildMediaGenerationContext,
    listMediaGenerationModels: sharedGeneration.listMediaGenerationModels,
    validateMediaGenerationSpec: sharedGeneration.validateMediaGenerationSpec,
    createMediaGenerationSpec: sharedGeneration.createMediaGenerationSpec,
    updateMediaGenerationSpec: sharedGeneration.updateMediaGenerationSpec,
    readMediaGenerationSpec: sharedGeneration.readMediaGenerationSpec,
    listMediaGenerationSpecs: sharedGeneration.listMediaGenerationSpecs,
    prepareMediaGenerationSpec: sharedGeneration.prepareMediaGenerationSpec,
    prepareDraftMediaGenerationSpec: sharedGeneration.prepareDraftMediaGenerationSpec,
    estimateMediaGenerationSpec: lifecycleEstimation.estimateMediaGenerationSpec,
    estimateDraftMediaGenerationSpec: costEstimation.estimateDraftMediaGenerationSpec,
    planMediaGenerationDependencies: sharedGeneration.planMediaGenerationDependencies,
    runMediaGenerationSpec: sharedGeneration.runMediaGenerationSpec,
  };
}
