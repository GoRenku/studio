import {
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  type CastVoiceSampleGenerationSpec,
} from '../../../../client/index.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as castVoiceSample from '../../purposes/cast-voice-sample.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toCastInput } from '../purpose-targets.js';

export const castVoiceSamplePurposeDefinition = {
  purpose: CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  mediaKind: 'audio',
  targetKind: 'castMember',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => castVoiceSample.buildCastVoiceSampleContext(toCastInput(input)),
  listModels: (input) => castVoiceSample.listCastVoiceSampleModels(toCastInput(input)),
  validateSpec: (input) => castVoiceSample.validateCastVoiceSampleSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastVoiceSampleGenerationSpec,
  }),
  createSpec: (input) => castVoiceSample.createCastVoiceSampleSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastVoiceSampleGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => castVoiceSample.updateCastVoiceSampleSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as CastVoiceSampleGenerationSpec,
  }),
  listSpecs: (input) => castVoiceSample.listCastVoiceSampleSpecs(toCastInput(input)),
  prepareSpec: castVoiceSample.prepareCastVoiceSampleSpec,
  prepareDraftSpec: (input) => castVoiceSample.prepareCastVoiceSampleDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as CastVoiceSampleGenerationSpec,
  }),
  runSpec: castVoiceSample.runCastVoiceSampleSpec,
} satisfies MediaGenerationPurposeDefinition;
