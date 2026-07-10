import * as contextGeneration from '../media-generation/lifecycle/context-service.js';
import * as costEstimation from '../media-generation/cost/spec-estimates.js';
import * as dependencyGeneration from '../media-generation/lifecycle/dependency-service.js';
import * as modelGeneration from '../media-generation/lifecycle/model-service.js';
import * as runGenerationService from '../media-generation/lifecycle/run-service.js';
import * as lifecycleEstimation from '../media-generation/lifecycle/spec-estimates.js';
import * as specGeneration from '../media-generation/lifecycle/spec-service.js';

export function createSharedMediaGenerationServiceWiring() {
  return {
    buildMediaGenerationContext: contextGeneration.buildMediaGenerationContext,
    listMediaGenerationModels: modelGeneration.listMediaGenerationModels,
    validateMediaGenerationSpec: specGeneration.validateMediaGenerationSpec,
    createMediaGenerationSpec: specGeneration.createMediaGenerationSpec,
    updateMediaGenerationSpec: specGeneration.updateMediaGenerationSpec,
    readMediaGenerationSpec: specGeneration.readMediaGenerationSpec,
    readMediaGenerationRun: runGenerationService.readMediaGenerationRun,
    listMediaGenerationSpecs: specGeneration.listMediaGenerationSpecs,
    prepareMediaGenerationSpec: specGeneration.prepareMediaGenerationSpec,
    prepareDraftMediaGenerationSpec: specGeneration.prepareDraftMediaGenerationSpec,
    buildMediaGenerationPreview: specGeneration.buildMediaGenerationPreview,
    buildDraftMediaGenerationPreview:
      specGeneration.buildDraftMediaGenerationPreview,
    updateGenerationPreviewSpec: specGeneration.updateGenerationPreviewSpec,
    estimateMediaGenerationSpec: lifecycleEstimation.estimateMediaGenerationSpec,
    estimateDraftMediaGenerationSpec: costEstimation.estimateDraftMediaGenerationSpec,
    planMediaGenerationDependencies:
      dependencyGeneration.planMediaGenerationDependencies,
    runMediaGenerationSpec: runGenerationService.runMediaGenerationSpec,
  };
}
