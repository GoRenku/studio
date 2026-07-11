import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  type CastCharacterSheetGenerationSpec,
} from '../../../../client/index.js';
import {
  castCharacterSheetImageRegeneration,
  updateCastCharacterSheetGenerationPreview,
} from '../../purposes/cast-character-sheet-preview.js';
import * as characterSheet from '../../purposes/cast-character-sheet.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toCastInput } from '../purpose-targets.js';

export const castCharacterSheetPurposeDefinition = {
  purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'castMember',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => characterSheet.buildCastCharacterSheetContext(toCastInput(input)),
  listModels: (input) => characterSheet.listCastCharacterSheetModels(toCastInput(input)),
  validateSpec: (input) => characterSheet.validateCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastCharacterSheetGenerationSpec,
  }),
  createSpec: (input) => characterSheet.createCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastCharacterSheetGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => characterSheet.updateCastCharacterSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as CastCharacterSheetGenerationSpec,
  }),
  listSpecs: (input) => characterSheet.listCastCharacterSheetSpecs(toCastInput(input)),
  prepareSpec: characterSheet.prepareCastCharacterSheetSpec,
  preview: {
    build: characterSheet.buildCastCharacterSheetGenerationPreview,
    update: updateCastCharacterSheetGenerationPreview,
  },
  imageRegeneration: castCharacterSheetImageRegeneration,
  prepareDraftSpec: (input) => characterSheet.prepareCastCharacterSheetDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastCharacterSheetGenerationSpec,
  }),
  declareDependencies: characterSheet.declareCastCharacterSheetDependencies,
  planDependencyDraft: characterSheet.buildCastCharacterSheetDependencyDraftSpec,
  runSpec: characterSheet.runCastCharacterSheetSpec,
} satisfies MediaGenerationPurposeDefinition;
