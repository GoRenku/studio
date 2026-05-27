import * as characterSheet from '../media-generation/cast-character-sheet.js';
import * as castProfile from '../media-generation/cast-profile.js';
import * as locationSheet from '../media-generation/location-environment-sheet.js';
import * as lookbookImage from '../media-generation/lookbook-image.js';

export function createMediaGenerationServiceWiring() {
  return {
    buildLookbookImageContext: lookbookImage.buildLookbookImageContext,
    listLookbookImageModels: lookbookImage.listLookbookImageModels,
    validateLookbookImageSpec: lookbookImage.validateLookbookImageSpec,
    createLookbookImageSpec: lookbookImage.createLookbookImageSpec,
    updateLookbookImageSpec: lookbookImage.updateLookbookImageSpec,
    readLookbookImageSpec: lookbookImage.readLookbookImageSpec,
    listLookbookImageSpecs: lookbookImage.listLookbookImageSpecs,
    prepareLookbookImageSpec: lookbookImage.prepareLookbookImageSpec,
    estimateLookbookImageSpec: lookbookImage.estimateLookbookImageSpec,
    runLookbookImageSpec: lookbookImage.runLookbookImageSpec,
    recordLookbookImageRun: lookbookImage.recordLookbookImageRun,
    importLookbookImageMedia: lookbookImage.importLookbookImageMedia,
    buildCastCharacterSheetContext:
      characterSheet.buildCastCharacterSheetContext,
    listCastCharacterSheetModels: characterSheet.listCastCharacterSheetModels,
    validateCastCharacterSheetSpec:
      characterSheet.validateCastCharacterSheetSpec,
    createCastCharacterSheetSpec: characterSheet.createCastCharacterSheetSpec,
    updateCastCharacterSheetSpec: characterSheet.updateCastCharacterSheetSpec,
    readCastCharacterSheetSpec: characterSheet.readCastCharacterSheetSpec,
    listCastCharacterSheetSpecs: characterSheet.listCastCharacterSheetSpecs,
    prepareCastCharacterSheetSpec:
      characterSheet.prepareCastCharacterSheetSpec,
    estimateCastCharacterSheetSpec:
      characterSheet.estimateCastCharacterSheetSpec,
    runCastCharacterSheetSpec: characterSheet.runCastCharacterSheetSpec,
    recordCastCharacterSheetRun: characterSheet.recordCastCharacterSheetRun,
    importCastCharacterSheetMedia:
      characterSheet.importCastCharacterSheetMedia,
    buildCastProfileContext: castProfile.buildCastProfileContext,
    listCastProfileModels: castProfile.listCastProfileModels,
    validateCastProfileSpec: castProfile.validateCastProfileSpec,
    createCastProfileSpec: castProfile.createCastProfileSpec,
    updateCastProfileSpec: castProfile.updateCastProfileSpec,
    readCastProfileSpec: castProfile.readCastProfileSpec,
    listCastProfileSpecs: castProfile.listCastProfileSpecs,
    prepareCastProfileSpec: castProfile.prepareCastProfileSpec,
    estimateCastProfileSpec: castProfile.estimateCastProfileSpec,
    runCastProfileSpec: castProfile.runCastProfileSpec,
    recordCastProfileRun: castProfile.recordCastProfileRun,
    importCastProfileMedia: castProfile.importCastProfileMedia,
    buildLocationEnvironmentSheetContext:
      locationSheet.buildLocationEnvironmentSheetContext,
    listLocationEnvironmentSheetModels:
      locationSheet.listLocationEnvironmentSheetModels,
    validateLocationEnvironmentSheetSpec:
      locationSheet.validateLocationEnvironmentSheetSpec,
    createLocationEnvironmentSheetSpec:
      locationSheet.createLocationEnvironmentSheetSpec,
    updateLocationEnvironmentSheetSpec:
      locationSheet.updateLocationEnvironmentSheetSpec,
    readLocationEnvironmentSheetSpec:
      locationSheet.readLocationEnvironmentSheetSpec,
    listLocationEnvironmentSheetSpecs:
      locationSheet.listLocationEnvironmentSheetSpecs,
    prepareLocationEnvironmentSheetSpec:
      locationSheet.prepareLocationEnvironmentSheetSpec,
    estimateLocationEnvironmentSheetSpec:
      locationSheet.estimateLocationEnvironmentSheetSpec,
    runLocationEnvironmentSheetSpec:
      locationSheet.runLocationEnvironmentSheetSpec,
    recordLocationEnvironmentSheetRun:
      locationSheet.recordLocationEnvironmentSheetRun,
    importLocationEnvironmentSheetMedia:
      locationSheet.importLocationEnvironmentSheetMedia,
  };
}
