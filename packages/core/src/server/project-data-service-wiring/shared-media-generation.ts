import * as sharedGeneration from '../media-generation/shared-generation-service.js';

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
    estimateMediaGenerationSpec: sharedGeneration.estimateMediaGenerationSpec,
    estimateDraftMediaGenerationSpec: sharedGeneration.estimateDraftMediaGenerationSpec,
    runMediaGenerationSpec: sharedGeneration.runMediaGenerationSpec,
  };
}
