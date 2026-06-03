import * as shotVideoTake from '../media-generation/shot-video-take.js';

export function createShotVideoTakeServiceWiring() {
  return {
    buildShotVideoTakeContext: shotVideoTake.buildShotVideoTakeContext,
    listShotVideoTakeModels: shotVideoTake.listShotVideoTakeModels,
    listShotVideoTakeInputs: shotVideoTake.listShotVideoTakeInputs,
    updateShotVideoTakeProductionGroup:
      shotVideoTake.updateShotVideoTakeProductionGroup,
    estimateShotVideoTakeProduction:
      shotVideoTake.estimateShotVideoTakeProduction,
    planShotVideoTakeProduction:
      shotVideoTake.planShotVideoTakeProduction,
    previewShotVideoTakeProduction: shotVideoTake.previewShotVideoTakeProduction,
    selectShotVideoTakeInput: shotVideoTake.selectShotVideoTakeInput,
    clearShotVideoTakeInputSelection:
      shotVideoTake.clearShotVideoTakeInputSelection,
    validateShotFirstFrameSpec: shotVideoTake.validateShotFirstFrameSpec,
    createShotFirstFrameSpec: shotVideoTake.createShotFirstFrameSpec,
    updateShotFirstFrameSpec: shotVideoTake.updateShotFirstFrameSpec,
    readShotFirstFrameSpec: shotVideoTake.readShotFirstFrameSpec,
    listShotFirstFrameSpecs: shotVideoTake.listShotFirstFrameSpecs,
    prepareShotFirstFrameSpec: shotVideoTake.prepareShotFirstFrameSpec,
    estimateShotFirstFrameSpec: shotVideoTake.estimateShotFirstFrameSpec,
    runShotFirstFrameSpec: shotVideoTake.runShotFirstFrameSpec,
    validateShotLastFrameSpec: shotVideoTake.validateShotLastFrameSpec,
    createShotLastFrameSpec: shotVideoTake.createShotLastFrameSpec,
    updateShotLastFrameSpec: shotVideoTake.updateShotLastFrameSpec,
    readShotLastFrameSpec: shotVideoTake.readShotLastFrameSpec,
    listShotLastFrameSpecs: shotVideoTake.listShotLastFrameSpecs,
    prepareShotLastFrameSpec: shotVideoTake.prepareShotLastFrameSpec,
    estimateShotLastFrameSpec: shotVideoTake.estimateShotLastFrameSpec,
    runShotLastFrameSpec: shotVideoTake.runShotLastFrameSpec,
    validateShotReferenceSheetSpec: shotVideoTake.validateShotReferenceSheetSpec,
    createShotReferenceSheetSpec: shotVideoTake.createShotReferenceSheetSpec,
    updateShotReferenceSheetSpec: shotVideoTake.updateShotReferenceSheetSpec,
    readShotReferenceSheetSpec: shotVideoTake.readShotReferenceSheetSpec,
    listShotReferenceSheetSpecs: shotVideoTake.listShotReferenceSheetSpecs,
    prepareShotReferenceSheetSpec: shotVideoTake.prepareShotReferenceSheetSpec,
    estimateShotReferenceSheetSpec: shotVideoTake.estimateShotReferenceSheetSpec,
    runShotReferenceSheetSpec: shotVideoTake.runShotReferenceSheetSpec,
    validateShotMultiShotStoryboardSheetSpec:
      shotVideoTake.validateShotMultiShotStoryboardSheetSpec,
    createShotMultiShotStoryboardSheetSpec:
      shotVideoTake.createShotMultiShotStoryboardSheetSpec,
    updateShotMultiShotStoryboardSheetSpec:
      shotVideoTake.updateShotMultiShotStoryboardSheetSpec,
    readShotMultiShotStoryboardSheetSpec:
      shotVideoTake.readShotMultiShotStoryboardSheetSpec,
    listShotMultiShotStoryboardSheetSpecs:
      shotVideoTake.listShotMultiShotStoryboardSheetSpecs,
    prepareShotMultiShotStoryboardSheetSpec:
      shotVideoTake.prepareShotMultiShotStoryboardSheetSpec,
    estimateShotMultiShotStoryboardSheetSpec:
      shotVideoTake.estimateShotMultiShotStoryboardSheetSpec,
    runShotMultiShotStoryboardSheetSpec:
      shotVideoTake.runShotMultiShotStoryboardSheetSpec,
    validateShotVideoTakeSpec: shotVideoTake.validateShotVideoTakeSpec,
    createShotVideoTakeSpec: shotVideoTake.createShotVideoTakeSpec,
    updateShotVideoTakeSpec: shotVideoTake.updateShotVideoTakeSpec,
    readShotVideoTakeSpec: shotVideoTake.readShotVideoTakeSpec,
    listShotVideoTakeSpecs: shotVideoTake.listShotVideoTakeSpecs,
    prepareShotVideoTakeSpec: shotVideoTake.prepareShotVideoTakeSpec,
    estimateShotVideoTakeSpec: shotVideoTake.estimateShotVideoTakeSpec,
    runShotVideoTakeSpec: shotVideoTake.runShotVideoTakeSpec,
    importShotFirstFrame: shotVideoTake.importShotFirstFrame,
    importShotLastFrame: shotVideoTake.importShotLastFrame,
    importShotReferenceSheet: shotVideoTake.importShotReferenceSheet,
    importShotMultiShotStoryboardSheet:
      shotVideoTake.importShotMultiShotStoryboardSheet,
    importShotVideoTake: shotVideoTake.importShotVideoTake,
  };
}
