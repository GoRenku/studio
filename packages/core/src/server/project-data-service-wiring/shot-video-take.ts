import * as shotVideoTake from '../media-generation/shot-video-take.js';
import * as sharedGeneration from '../media-generation/shared-generation-service.js';

export function createShotVideoTakeServiceWiring() {
  return {
    buildShotVideoTakeContext: shotVideoTake.buildShotVideoTakeContext,
    listShotVideoTakeModels: shotVideoTake.listShotVideoTakeModels,
    listShotVideoTakeInputs: shotVideoTake.listShotVideoTakeInputs,
    updateShotVideoTakeProductionGroup:
      shotVideoTake.updateShotVideoTakeProductionGroup,
    updateShotVideoTakeRailGroups: shotVideoTake.updateShotVideoTakeRailGroups,
    estimateShotVideoTakeProduction:
      shotVideoTake.estimateShotVideoTakeProduction,
    planShotVideoTakeProduction:
      shotVideoTake.planShotVideoTakeProduction,
    readShotVideoTakeProductionPlan:
      shotVideoTake.readShotVideoTakeProductionPlan,
    previewShotVideoTakeProduction: shotVideoTake.previewShotVideoTakeProduction,
    resolveShotVideoTakeInputFile: shotVideoTake.resolveShotVideoTakeInputFile,
    selectShotVideoTakeInput: shotVideoTake.selectShotVideoTakeInput,
    clearShotVideoTakeInputSelection:
      shotVideoTake.clearShotVideoTakeInputSelection,
    validateShotFirstFrameSpec: shotVideoTake.validateShotFirstFrameSpec,
    createShotFirstFrameSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotFirstFrameSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotFirstFrameSpec: sharedGeneration.readMediaGenerationSpec,
    listShotFirstFrameSpecs: shotVideoTake.listShotFirstFrameSpecs,
    prepareShotFirstFrameSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotFirstFrameSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotFirstFrameSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotLastFrameSpec: shotVideoTake.validateShotLastFrameSpec,
    createShotLastFrameSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotLastFrameSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotLastFrameSpec: sharedGeneration.readMediaGenerationSpec,
    listShotLastFrameSpecs: shotVideoTake.listShotLastFrameSpecs,
    prepareShotLastFrameSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotLastFrameSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotLastFrameSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotReferenceSheetSpec: shotVideoTake.validateShotReferenceSheetSpec,
    createShotReferenceSheetSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotReferenceSheetSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotReferenceSheetSpec: sharedGeneration.readMediaGenerationSpec,
    listShotReferenceSheetSpecs: shotVideoTake.listShotReferenceSheetSpecs,
    prepareShotReferenceSheetSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotReferenceSheetSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotReferenceSheetSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotMultiShotStoryboardSheetSpec:
      shotVideoTake.validateShotMultiShotStoryboardSheetSpec,
    createShotMultiShotStoryboardSheetSpec:
      sharedGeneration.createMediaGenerationSpec,
    updateShotMultiShotStoryboardSheetSpec:
      sharedGeneration.updateMediaGenerationSpec,
    readShotMultiShotStoryboardSheetSpec:
      sharedGeneration.readMediaGenerationSpec,
    listShotMultiShotStoryboardSheetSpecs:
      shotVideoTake.listShotMultiShotStoryboardSheetSpecs,
    prepareShotMultiShotStoryboardSheetSpec:
      sharedGeneration.prepareMediaGenerationSpec,
    estimateShotMultiShotStoryboardSheetSpec:
      sharedGeneration.estimateMediaGenerationSpec,
    runShotMultiShotStoryboardSheetSpec:
      sharedGeneration.runMediaGenerationSpec,
    validateShotVideoTakeSpec: shotVideoTake.validateShotVideoTakeSpec,
    createShotVideoTakeSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotVideoTakeSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotVideoTakeSpec: sharedGeneration.readMediaGenerationSpec,
    listShotVideoTakeSpecs: shotVideoTake.listShotVideoTakeSpecs,
    prepareShotVideoTakeSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotVideoTakeSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotVideoTakeSpec: sharedGeneration.runMediaGenerationSpec,
    importShotFirstFrame: shotVideoTake.importShotFirstFrame,
    importShotLastFrame: shotVideoTake.importShotLastFrame,
    importShotReferenceSheet: shotVideoTake.importShotReferenceSheet,
    importShotMultiShotStoryboardSheet:
      shotVideoTake.importShotMultiShotStoryboardSheet,
    importShotVideoTake: shotVideoTake.importShotVideoTake,
  };
}
