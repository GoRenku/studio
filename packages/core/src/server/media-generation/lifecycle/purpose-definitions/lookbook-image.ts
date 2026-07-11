import {
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  type LookbookImageGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { createAuthoredPromptImageRegeneration } from '../../../image-revision/authored-prompt-regeneration.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as lookbookImage from '../../purposes/lookbook-image.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toLookbookInput } from '../purpose-targets.js';

export const lookbookImagePurposeDefinition = {
  purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'lookbook',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => lookbookImage.buildLookbookImageContext(toLookbookInput(input)),
  listModels: (input) => lookbookImage.listLookbookImageModels(toLookbookInput(input)),
  validateSpec: (input) => lookbookImage.validateLookbookImageSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LookbookImageGenerationSpec,
  }),
  createSpec: (input) => lookbookImage.createLookbookImageSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LookbookImageGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => lookbookImage.updateLookbookImageSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as LookbookImageGenerationSpec,
  }),
  listSpecs: (input) => lookbookImage.listLookbookImageSpecs(toLookbookInput(input)),
  prepareSpec: lookbookImage.prepareLookbookImageSpec,
  preview: {
    build: lookbookImage.buildLookbookImageGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(lookbookImage.updateLookbookImageSpec),
  },
  imageRegeneration: createAuthoredPromptImageRegeneration(),
  prepareDraftSpec: (input) => lookbookImage.prepareLookbookImageDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as LookbookImageGenerationSpec,
  }),
  runSpec: lookbookImage.runLookbookImageSpec,
} satisfies MediaGenerationPurposeDefinition;
