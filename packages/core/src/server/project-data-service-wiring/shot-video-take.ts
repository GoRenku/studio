import { buildShotVideoTakeContext, readSceneShotVideoTakeEditContext } from '../media-generation/shot-video-take/context.js';
import { listShotVideoTakeModels } from '../media-generation/shot-video-take/model-list.js';
import { listShotVideoTakeInputs, resolveShotVideoTakeInputFile, resolveShotVideoTakeVideoFile, selectShotVideoTakeInput, clearShotVideoTakeInputSelection, deleteShotVideoTakeInput } from '../media-generation/shot-video-take/input-selection.js';
import { createSceneShotVideoTake, deleteSceneShotVideoTake, listSceneShotVideoTakes, readSceneShotVideoTake, updateSceneShotVideoTakePick, updateSceneShotVideoTakeProduction, updateSceneShotVideoTakeDirection, updateSceneShotVideoTakeShots, updateSceneShotVideoTakeStructureMode } from '../media-generation/shot-video-take/takes.js';
import { updateSceneShotVideoTakeCharacterSheetSelection, updateSceneShotVideoTakeLocationSheetSelection, updateSceneShotVideoTakeLookbookSheetSelection, updateSceneShotVideoTakeDialogueAudioSelection, updateSceneShotVideoTakeReferenceInclusion } from '../media-generation/shot-video-take/reference-selection-mutations.js';
import { planShotVideoTakeProduction, readShotVideoTakeProductionPlan } from '../media-generation/shot-video-take/production-plan.js';
import { estimateShotVideoTakeProduction } from '../media-generation/lifecycle/shot-video-take-production-estimates.js';
import { previewShotVideoTakeProduction } from '../media-generation/shot-video-take/preflight-report.js';
import { validateShotFirstFrameSpec, validateShotLastFrameSpec, validateShotReferenceImageSpec, validateShotVideoPromptSheetSpec, listShotFirstFrameSpecs, listShotLastFrameSpecs, listShotReferenceImageSpecs, listShotVideoPromptSheetSpecs } from '../media-generation/shot-video-take/input-specs.js';
import { prepareShotVideoTakeSpec, validateShotVideoTakeSpec, listShotVideoTakeSpecs } from '../media-generation/shot-video-take/final-specs.js';
import { runShotVideoTakeSpec } from '../media-generation/shot-video-take/generation-runs.js';
import { importShotFirstFrame, importShotLastFrame, importShotReferenceImage, importShotVideoPromptSheet, importShotVideoTake } from '../media-generation/shot-video-take/media-imports.js';
import { applySceneShotVideoTakeAuthoringDocument, readSceneShotVideoTakeAuthoringContext, validateSceneShotVideoTakeAuthoringDocument } from '../media-generation/shot-video-take/authoring.js';
import * as sharedGeneration from '../media-generation/shared-generation-service.js';
import * as estimation from '../media-generation/lifecycle/spec-estimates.js';
export function createShotVideoTakeServiceWiring() {
  return {
    createSceneShotVideoTake,
    readSceneShotVideoTake,
    listSceneShotVideoTakes,
    deleteSceneShotVideoTake,
    updateSceneShotVideoTakePick,
    updateSceneShotVideoTakeProduction,
    updateSceneShotVideoTakeDirection,
    updateSceneShotVideoTakeStructureMode,
    updateSceneShotVideoTakeShots,
    updateSceneShotVideoTakeCharacterSheetSelection,
    updateSceneShotVideoTakeLocationSheetSelection,
    updateSceneShotVideoTakeLookbookSheetSelection,
    updateSceneShotVideoTakeDialogueAudioSelection,
    updateSceneShotVideoTakeReferenceInclusion,
    buildShotVideoTakeContext,
    readSceneShotVideoTakeEditContext,
    listShotVideoTakeModels,
    listShotVideoTakeInputs,
    estimateShotVideoTakeProduction,
    planShotVideoTakeProduction,
    readShotVideoTakeProductionPlan,
    previewShotVideoTakeProduction,
    resolveShotVideoTakeInputFile,
    resolveShotVideoTakeVideoFile,
    selectShotVideoTakeInput,
    clearShotVideoTakeInputSelection,
    deleteShotVideoTakeInput,
    validateShotFirstFrameSpec,
    createShotFirstFrameSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotFirstFrameSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotFirstFrameSpec: sharedGeneration.readMediaGenerationSpec,
    listShotFirstFrameSpecs,
    prepareShotFirstFrameSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotFirstFrameSpec: estimation.estimateMediaGenerationSpec,
    runShotFirstFrameSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotLastFrameSpec,
    createShotLastFrameSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotLastFrameSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotLastFrameSpec: sharedGeneration.readMediaGenerationSpec,
    listShotLastFrameSpecs,
    prepareShotLastFrameSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotLastFrameSpec: estimation.estimateMediaGenerationSpec,
    runShotLastFrameSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotReferenceImageSpec,
    createShotReferenceImageSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotReferenceImageSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotReferenceImageSpec: sharedGeneration.readMediaGenerationSpec,
    listShotReferenceImageSpecs,
    prepareShotReferenceImageSpec: sharedGeneration.prepareMediaGenerationSpec,
    estimateShotReferenceImageSpec: estimation.estimateMediaGenerationSpec,
    runShotReferenceImageSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotVideoPromptSheetSpec,
    createShotVideoPromptSheetSpec:
      sharedGeneration.createMediaGenerationSpec,
    updateShotVideoPromptSheetSpec:
      sharedGeneration.updateMediaGenerationSpec,
    readShotVideoPromptSheetSpec:
      sharedGeneration.readMediaGenerationSpec,
    listShotVideoPromptSheetSpecs,
    prepareShotVideoPromptSheetSpec:
      sharedGeneration.prepareMediaGenerationSpec,
    estimateShotVideoPromptSheetSpec:
      estimation.estimateMediaGenerationSpec,
    runShotVideoPromptSheetSpec: sharedGeneration.runMediaGenerationSpec,
    validateShotVideoTakeSpec,
    createShotVideoTakeSpec: sharedGeneration.createMediaGenerationSpec,
    updateShotVideoTakeSpec: sharedGeneration.updateMediaGenerationSpec,
    readShotVideoTakeSpec: sharedGeneration.readMediaGenerationSpec,
    listShotVideoTakeSpecs,
    prepareShotVideoTakeSpec,
    estimateShotVideoTakeSpec: estimation.estimateMediaGenerationSpec,
    runShotVideoTakeSpec,
    importShotFirstFrame,
    importShotLastFrame,
    importShotReferenceImage,
    importShotVideoPromptSheet,
    importShotVideoTake,
    readSceneShotVideoTakeAuthoringContext,
    validateSceneShotVideoTakeAuthoringDocument,
    applySceneShotVideoTakeAuthoringDocument,
  };
}
