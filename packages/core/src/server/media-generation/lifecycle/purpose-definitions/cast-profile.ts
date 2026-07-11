import {
  CAST_PROFILE_GENERATION_PURPOSE,
  type CastProfileGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as castProfile from '../../purposes/cast-profile.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toCastInput } from '../purpose-targets.js';

export const castProfilePurposeDefinition = {
  purpose: CAST_PROFILE_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'castMember',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => castProfile.buildCastProfileContext(toCastInput(input)),
  listModels: (input) => castProfile.listCastProfileModels(toCastInput(input)),
  validateSpec: (input) => castProfile.validateCastProfileSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastProfileGenerationSpec,
  }),
  createSpec: (input) => castProfile.createCastProfileSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastProfileGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => castProfile.updateCastProfileSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as CastProfileGenerationSpec,
  }),
  listSpecs: (input) => castProfile.listCastProfileSpecs(toCastInput(input)),
  prepareSpec: castProfile.prepareCastProfileSpec,
  preview: {
    build: castProfile.buildCastProfileGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(castProfile.updateCastProfileSpec),
  },
  prepareDraftSpec: (input) => castProfile.prepareCastProfileDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastProfileGenerationSpec,
  }),
  declareDependencies: castProfile.declareCastProfileDependencies,
  runSpec: castProfile.runCastProfileSpec,
} satisfies MediaGenerationPurposeDefinition;
