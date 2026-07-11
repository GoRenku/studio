import {
  IMAGE_CREATE_GENERATION_PURPOSE,
  type ImageCreateGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { createAuthoredPromptImageRegeneration } from '../../../image-revision/authored-prompt-regeneration.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import { buildShotInputDependencyDraftSpec } from '../../purposes/shot-video-take/planning/dependency-draft-specs.js';
import * as imageCreate from '../../purposes/image-create.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toProjectInput } from '../purpose-targets.js';

export const imageCreatePurposeDefinition = {
  purpose: IMAGE_CREATE_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'project',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => imageCreate.buildImageCreateContext(toProjectInput(input)),
  listModels: (input) => imageCreate.listImageCreateModels(toProjectInput(input)),
  validateSpec: (input) => imageCreate.validateImageCreateSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ImageCreateGenerationSpec,
  }),
  createSpec: (input) => imageCreate.createImageCreateSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ImageCreateGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => imageCreate.updateImageCreateSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as ImageCreateGenerationSpec,
  }),
  listSpecs: (input) => imageCreate.listImageCreateSpecs(toProjectInput(input)),
  prepareSpec: imageCreate.prepareImageCreateSpec,
  preview: {
    build: imageCreate.buildImageCreateGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(imageCreate.updateImageCreateSpec),
  },
  imageRegeneration: createAuthoredPromptImageRegeneration(),
  prepareDraftSpec: (input) => imageCreate.prepareImageCreateDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ImageCreateGenerationSpec,
  }),
  planDependencyDraft: buildShotInputDependencyDraftSpec,
  runSpec: imageCreate.runImageCreateSpec,
} satisfies MediaGenerationPurposeDefinition;
