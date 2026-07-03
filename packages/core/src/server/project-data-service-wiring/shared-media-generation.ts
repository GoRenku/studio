import * as sharedGeneration from '../media-generation/shared-generation-service.js';
import * as estimation from '../media-generation/estimation/spec-estimates.js';

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
    estimateMediaGenerationSpec: estimation.estimateMediaGenerationSpec,
    estimateDraftMediaGenerationSpec: estimation.estimateDraftMediaGenerationSpec,
    planMediaGenerationDependencies: sharedGeneration.planMediaGenerationDependencies,
    runMediaGenerationSpec: sharedGeneration.runMediaGenerationSpec,
  };
}
