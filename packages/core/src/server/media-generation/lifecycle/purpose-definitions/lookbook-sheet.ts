import {
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  type LookbookSheetGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { createAuthoredPromptImageRegeneration } from '../../../image-revision/authored-prompt-regeneration.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as lookbookSheet from '../../purposes/lookbook-sheet.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toLookbookInput } from '../purpose-targets.js';

export const lookbookSheetPurposeDefinition = {
  purpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'lookbook',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => lookbookSheet.buildLookbookSheetContext(toLookbookInput(input)),
  listModels: (input) => lookbookSheet.listLookbookSheetModels(toLookbookInput(input)),
  validateSpec: (input) => lookbookSheet.validateLookbookSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LookbookSheetGenerationSpec,
  }),
  createSpec: (input) => lookbookSheet.createLookbookSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LookbookSheetGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => lookbookSheet.updateLookbookSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as LookbookSheetGenerationSpec,
  }),
  listSpecs: (input) => lookbookSheet.listLookbookSheetSpecs(toLookbookInput(input)),
  prepareSpec: lookbookSheet.prepareLookbookSheetSpec,
  preview: {
    build: lookbookSheet.buildLookbookSheetGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(lookbookSheet.updateLookbookSheetSpec),
  },
  imageRegeneration: createAuthoredPromptImageRegeneration(),
  prepareDraftSpec: (input) => lookbookSheet.prepareLookbookSheetDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LookbookSheetGenerationSpec,
  }),
  planDependencyDraft: lookbookSheet.buildLookbookSheetDependencyDraftSpec,
  runSpec: lookbookSheet.runLookbookSheetSpec,
} satisfies MediaGenerationPurposeDefinition;
