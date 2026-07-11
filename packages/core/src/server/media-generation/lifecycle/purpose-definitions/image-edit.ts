import {
  IMAGE_EDIT_GENERATION_PURPOSE,
  type ImageEditGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { createAuthoredPromptImageRegeneration } from '../../../image-revision/authored-prompt-regeneration.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as imageEdit from '../../purposes/image-edit.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toAssetInput } from '../purpose-targets.js';

export const imageEditPurposeDefinition = {
  purpose: IMAGE_EDIT_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'asset',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => imageEdit.buildImageEditContext(toAssetInput(input)),
  listModels: (input) => imageEdit.listImageEditModels(toAssetInput(input)),
  validateSpec: (input) => imageEdit.validateImageEditSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ImageEditGenerationSpec,
  }),
  createSpec: (input) => imageEdit.createImageEditSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ImageEditGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => imageEdit.updateImageEditSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as ImageEditGenerationSpec,
  }),
  listSpecs: (input) => imageEdit.listImageEditSpecs(toAssetInput(input)),
  prepareSpec: imageEdit.prepareImageEditSpec,
  preview: {
    build: imageEdit.buildImageEditGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(imageEdit.updateImageEditSpec),
  },
  imageRegeneration: createAuthoredPromptImageRegeneration(),
  prepareDraftSpec: (input) => imageEdit.prepareImageEditDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ImageEditGenerationSpec,
  }),
  runSpec: imageEdit.runImageEditSpec,
} satisfies MediaGenerationPurposeDefinition;
