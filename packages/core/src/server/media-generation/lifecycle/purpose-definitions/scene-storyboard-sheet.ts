import {
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  type SceneStoryboardSheetGenerationSpec,
} from '../../../../client/index.js';
import { createAuthoredPromptPreviewUpdate } from '../../../generation-preview/authored-prompt-update.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as sceneStoryboardSheet from '../../purposes/scene-storyboard-sheet.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { toSceneInput } from '../purpose-targets.js';

export const sceneStoryboardSheetPurposeDefinition = {
  purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  mediaKind: 'image',
  targetKind: 'scene',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => sceneStoryboardSheet.buildSceneStoryboardSheetContext(toSceneInput(input)),
  listModels: (input) => sceneStoryboardSheet.listSceneStoryboardSheetModels(toSceneInput(input)),
  validateSpec: (input) => sceneStoryboardSheet.validateSceneStoryboardSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as SceneStoryboardSheetGenerationSpec,
  }),
  createSpec: (input) => sceneStoryboardSheet.createSceneStoryboardSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as SceneStoryboardSheetGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => sceneStoryboardSheet.updateSceneStoryboardSheetSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as SceneStoryboardSheetGenerationSpec,
  }),
  listSpecs: (input) => sceneStoryboardSheet.listSceneStoryboardSheetSpecs(toSceneInput(input)),
  prepareSpec: sceneStoryboardSheet.prepareSceneStoryboardSheetSpec,
  preview: {
    build: sceneStoryboardSheet.buildSceneStoryboardSheetGenerationPreview,
    update: createAuthoredPromptPreviewUpdate(sceneStoryboardSheet.updateSceneStoryboardSheetSpec),
  },
  prepareDraftSpec: (input) => sceneStoryboardSheet.prepareSceneStoryboardSheetDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as SceneStoryboardSheetGenerationSpec,
  }),
  declareDependencies: sceneStoryboardSheet.declareSceneStoryboardSheetDependencies,
  runSpec: sceneStoryboardSheet.runSceneStoryboardSheetSpec,
} satisfies MediaGenerationPurposeDefinition;
