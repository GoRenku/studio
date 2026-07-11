import {
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  type LocationEnvironmentSheetGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { createAuthoredPromptImageRegeneration } from '../../../image-revision/authored-prompt-regeneration.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as locationSheet from '../../purposes/location-environment-sheet.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toLocationInput } from '../purpose-targets.js';

export const locationEnvironmentSheetPurposeDefinition = {
  purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'location',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => locationSheet.buildLocationEnvironmentSheetContext(toLocationInput(input)),
  listModels: (input) => locationSheet.listLocationEnvironmentSheetModels(toLocationInput(input)),
  validateSpec: (input) => locationSheet.validateLocationEnvironmentSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LocationEnvironmentSheetGenerationSpec,
  }),
  createSpec: (input) => locationSheet.createLocationEnvironmentSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LocationEnvironmentSheetGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => locationSheet.updateLocationEnvironmentSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as LocationEnvironmentSheetGenerationSpec,
  }),
  listSpecs: (input) => locationSheet.listLocationEnvironmentSheetSpecs(toLocationInput(input)),
  prepareSpec: locationSheet.prepareLocationEnvironmentSheetSpec,
  preview: {
    build: locationSheet.buildLocationEnvironmentSheetGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(locationSheet.updateLocationEnvironmentSheetSpec),
  },
  imageRegeneration: createAuthoredPromptImageRegeneration(),
  prepareDraftSpec: (input) => locationSheet.prepareLocationEnvironmentSheetDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LocationEnvironmentSheetGenerationSpec,
  }),
  planDependencyDraft: locationSheet.buildLocationEnvironmentSheetDependencyDraftSpec,
  runSpec: locationSheet.runLocationEnvironmentSheetSpec,
} satisfies MediaGenerationPurposeDefinition;
