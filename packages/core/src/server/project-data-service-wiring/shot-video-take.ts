import { buildShotVideoTakeContext } from '../media-generation/shot-video-take/context.js';
import { listShotVideoTakeModels } from '../media-generation/shot-video-take/model-list.js';
import { listShotVideoTakeInputs, resolveShotVideoTakeInputFile, selectShotVideoTakeInput, clearShotVideoTakeInputSelection, deleteShotVideoTakeInput } from '../media-generation/shot-video-take/input-selection.js';
import { updateShotVideoTakeProductionGroup, updateShotVideoTakeRailGroups } from '../media-generation/shot-video-take/production-groups.js';
import { estimateShotVideoTakeProduction, planShotVideoTakeProduction, readShotVideoTakeProductionPlan } from '../media-generation/shot-video-take/production-plan.js';
import { previewShotVideoTakeProduction } from '../media-generation/shot-video-take/preflight-report.js';
import { validateShotFirstFrameSpec, validateShotLastFrameSpec, validateShotReferenceImageSpec, validateShotMultiShotStoryboardSheetSpec, listShotFirstFrameSpecs, listShotLastFrameSpecs, listShotReferenceImageSpecs, listShotMultiShotStoryboardSheetSpecs } from '../media-generation/shot-video-take/input-specs.js';
import { estimateShotVideoTakeSpec, prepareShotVideoTakeSpec, validateShotVideoTakeSpec, listShotVideoTakeSpecs } from '../media-generation/shot-video-take/final-specs.js';
import { runShotVideoTakeSpec } from '../media-generation/shot-video-take/generation-runs.js';
import { importShotFirstFrame, importShotLastFrame, importShotReferenceImage, importShotMultiShotStoryboardSheet, importShotVideoTake } from '../media-generation/shot-video-take/media-imports.js';
import * as sharedGeneration from '../media-generation/shared-generation-service.js';

export function createShotVideoTakeServiceWiring() {
  return {
    buildShotVideoTakeContext: buildShotVideoTakeContext,
    listShotVideoTakeModels: listShotVideoTakeModels,
    listShotVideoTakeInputs: listShotVideoTakeInputs,
    updateShotVideoTakeProductionGroup:
      updateShotVideoTakeProductionGroup,
    updateShotVideoTakeRailGroups: updateShotVideoTakeRailGroups,
    estimateShotVideoTakeProduction:
      estimateShotVideoTakeProduction,
    planShotVideoTakeProduction:
      planShotVideoTakeProduction,
    readShotVideoTakeProductionPlan:
      readShotVideoTakeProductionPlan,
    previewShotVideoTakeProduction: previewShotVideoTakeProduction,
    resolveShotVideoTakeInputFile: resolveShotVideoTakeInputFile,
    selectShotVideoTakeInput: selectShotVideoTakeInput,
    clearShotVideoTakeInputSelection:
      clearShotVideoTakeInputSelection,
    deleteShotVideoTakeInput: deleteShotVideoTakeInput,
    validateShotFirstFrameSpec: validateShotFirstFrameSpec,
    createShotFirstFrameSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotFirstFrameSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotFirstFrameSpec: sharedGeneration.readMediaGenerationSpec,
    listShotFirstFrameSpecs: listShotFirstFrameSpecs,
    prepareShotFirstFrameSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotFirstFrameSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotFirstFrameSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotLastFrameSpec: validateShotLastFrameSpec,
    createShotLastFrameSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotLastFrameSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotLastFrameSpec: sharedGeneration.readMediaGenerationSpec,
    listShotLastFrameSpecs: listShotLastFrameSpecs,
    prepareShotLastFrameSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotLastFrameSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotLastFrameSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotReferenceImageSpec: validateShotReferenceImageSpec,
    createShotReferenceImageSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotReferenceImageSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotReferenceImageSpec: sharedGeneration.readMediaGenerationSpec,
    listShotReferenceImageSpecs: listShotReferenceImageSpecs,
    prepareShotReferenceImageSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotReferenceImageSpec: sharedGeneration.estimateMediaGenerationSpec,
    runShotReferenceImageSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotMultiShotStoryboardSheetSpec:
      validateShotMultiShotStoryboardSheetSpec,
    createShotMultiShotStoryboardSheetSpec:
      sharedGeneration.createMediaGenerationSpec,
    updateShotMultiShotStoryboardSheetSpec:
      sharedGeneration.updateMediaGenerationSpec,
    readShotMultiShotStoryboardSheetSpec:
      sharedGeneration.readMediaGenerationSpec,
    listShotMultiShotStoryboardSheetSpecs:
      listShotMultiShotStoryboardSheetSpecs,
    prepareShotMultiShotStoryboardSheetSpec:
      sharedGeneration.prepareMediaGenerationSpec,
    estimateShotMultiShotStoryboardSheetSpec:
      sharedGeneration.estimateMediaGenerationSpec,
    runShotMultiShotStoryboardSheetSpec:
      sharedGeneration.runMediaGenerationSpec,
    validateShotVideoTakeSpec: validateShotVideoTakeSpec,
    createShotVideoTakeSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotVideoTakeSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotVideoTakeSpec: sharedGeneration.readMediaGenerationSpec,
    listShotVideoTakeSpecs: listShotVideoTakeSpecs,
    prepareShotVideoTakeSpec: prepareShotVideoTakeSpec,
    estimateShotVideoTakeSpec: estimateShotVideoTakeSpec,
    runShotVideoTakeSpec: runShotVideoTakeSpec,
    importShotFirstFrame: importShotFirstFrame,
    importShotLastFrame: importShotLastFrame,
    importShotReferenceImage: importShotReferenceImage,
    importShotMultiShotStoryboardSheet:
      importShotMultiShotStoryboardSheet,
    importShotVideoTake: importShotVideoTake,
  };
}
