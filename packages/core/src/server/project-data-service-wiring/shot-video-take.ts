import { buildShotVideoTakeContext, readSceneShotVideoTakeEditContext } from '../media-generation/purposes/shot-video-take/authoring/context.js';
import { listShotVideoTakeModels } from '../media-generation/purposes/shot-video-take/specs/model-list.js';
import { listShotVideoTakeInputs, resolveShotVideoTakeInputFile, resolveShotVideoTakeVideoFile, selectShotVideoTakeInput, clearShotVideoTakeInputSelection, deleteShotVideoTakeInput } from '../media-generation/purposes/shot-video-take/selection/input-selection.js';
import { createSceneShotVideoTake, deleteSceneShotVideoTake, listSceneShotVideoTakes, readSceneShotVideoTake, updateSceneShotVideoTakePick, updateSceneShotVideoTakeProduction, updateSceneShotVideoTakeDirection, updateSceneShotVideoTakeShots, updateSceneShotVideoTakeStructureMode } from '../media-generation/purposes/shot-video-take/persistence/takes.js';
import { repairShotVideoTakeOwnedMedia } from '../media-generation/purposes/shot-video-take/ownership/take-owned-media-repair.js';
import { updateSceneShotVideoTakeCharacterSheetSelection, updateSceneShotVideoTakeLocationSheetSelection, updateSceneShotVideoTakeLookbookSheetSelection, updateSceneShotVideoTakeDialogueAudioSelection, updateSceneShotVideoTakeReferenceInclusion } from '../media-generation/purposes/shot-video-take/selection/mutations/reference-selections.js';
import { planShotVideoTakeProduction, readShotVideoTakeProductionPlan } from '../media-generation/purposes/shot-video-take/planning/production-plan.js';
import { estimateShotVideoTakeProduction } from '../media-generation/lifecycle/shot-video-take-production-estimates.js';
import { previewShotVideoTakeProduction } from '../media-generation/purposes/shot-video-take/planning/preflight-report.js';
import { prepareShotVideoTakeSpec, validateShotVideoTakeSpec, listShotVideoTakeSpecs } from '../media-generation/purposes/shot-video-take/specs/final-specs.js';
import { runShotVideoTakeSpec } from '../media-generation/purposes/shot-video-take/runs/generation-runs.js';
import { importShotInputMedia, importShotVideoTake } from '../media-generation/purposes/shot-video-take/imports/media-imports.js';
import { applySceneShotVideoTakeAuthoringDocument, readSceneShotVideoTakeAuthoringContext, validateSceneShotVideoTakeAuthoringDocument } from '../media-generation/purposes/shot-video-take/authoring/authoring.js';
import * as specGeneration from '../media-generation/lifecycle/spec-service.js';
import * as estimation from '../media-generation/lifecycle/spec-estimates.js';
export function createShotVideoTakeServiceWiring() {
  return {
    createSceneShotVideoTake,
    readSceneShotVideoTake,
    listSceneShotVideoTakes,
    deleteSceneShotVideoTake,
    repairShotVideoTakeOwnedMedia,
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
    validateShotVideoTakeSpec,
    createShotVideoTakeSpec: specGeneration.createMediaGenerationSpec,
    updateShotVideoTakeSpec: specGeneration.updateMediaGenerationSpec,
    readShotVideoTakeSpec: specGeneration.readMediaGenerationSpec,
    listShotVideoTakeSpecs,
    prepareShotVideoTakeSpec,
    estimateShotVideoTakeSpec: estimation.estimateMediaGenerationSpec,
    runShotVideoTakeSpec,
    importShotInputMedia,
    importShotVideoTake,
    readSceneShotVideoTakeAuthoringContext,
    validateSceneShotVideoTakeAuthoringDocument,
    applySceneShotVideoTakeAuthoringDocument,
  };
}
