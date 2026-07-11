import {
  LOCATION_HERO_GENERATION_PURPOSE,
  type LocationHeroGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as locationHero from '../../purposes/location-hero.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toLocationHeroInput, toLocationInput } from '../purpose-targets.js';

export const locationHeroPurposeDefinition = {
  purpose: LOCATION_HERO_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'location',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => locationHero.buildLocationHeroContext(toLocationHeroInput(input)),
  listModels: (input) => locationHero.listLocationHeroModels(toLocationHeroInput(input)),
  validateSpec: (input) => locationHero.validateLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LocationHeroGenerationSpec,
  }),
  createSpec: (input) => locationHero.createLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LocationHeroGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => locationHero.updateLocationHeroSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as LocationHeroGenerationSpec,
  }),
  listSpecs: (input) => locationHero.listLocationHeroSpecs(toLocationInput(input)),
  prepareSpec: locationHero.prepareLocationHeroSpec,
  preview: {
    build: locationHero.buildLocationHeroGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(locationHero.updateLocationHeroSpec),
  },
  prepareDraftSpec: (input) => locationHero.prepareLocationHeroDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LocationHeroGenerationSpec,
  }),
  runSpec: locationHero.runLocationHeroSpec,
} satisfies MediaGenerationPurposeDefinition;
