import type {
  CastCharacterSheetGenerationContext,
  CastCharacterSheetGenerationSpec,
  CastCharacterSheetModelListReport,
  CastMediaImportReport,
  CastProfileGenerationContext,
  CastProfileGenerationSpec,
  CastProfileModelListReport,
  CastVoiceSampleGenerationContext,
  CastVoiceSampleGenerationSpec,
  CastVoiceSampleModelListReport,
  LocationEnvironmentSheetGenerationContext,
  LocationEnvironmentSheetGenerationSpec,
  LocationEnvironmentSheetMediaImportReport,
  LocationEnvironmentSheetModelListReport,
  LookbookImageGenerationContext,
  LookbookImageGenerationSpec,
  LookbookImageMediaImportReport,
  LookbookImageModelListReport,
  LookbookSheetGenerationContext,
  LookbookSheetGenerationSpec,
  LookbookSheetMediaImportReport,
  LookbookSheetModelListReport,
  MediaGenerationPurpose,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySlot,
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
  MediaGenerationRequestTarget,
  MediaGenerationTarget,
  MediaKind,
  PreparedMediaGeneration,
  SceneStoryboardSheetGenerationContext,
  SceneStoryboardSheetGenerationSpec,
  SceneStoryboardImagesImportReport,
  SceneStoryboardSheetModelListReport,
  SceneDialogueAudioContext,
  SceneDialogueAudioGenerationSpec,
  SceneDialogueAudioModelListReport,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeMediaImportReport,
  ShotVideoTakeInputModelListReport,
  ShotVideoTakeModelListReport,
} from '../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  CastMediaGenerationContextInput,
  CreateCastCharacterSheetGenerationSpecInput,
  CreateCastProfileGenerationSpecInput,
  CreateLocationEnvironmentSheetGenerationSpecInput,
  CreateLookbookImageGenerationSpecInput,
  CreateLookbookSheetGenerationSpecInput,
  CreateSceneStoryboardSheetGenerationSpecInput,
  CreateShotVideoTakeGenerationSpecInput,
  CreateShotVideoTakeInputGenerationSpecInput,
  ImportCastMediaInput,
  ImportLocationEnvironmentSheetMediaInput,
  ImportLookbookImageMediaInput,
  ImportLookbookSheetMediaInput,
  ImportSceneStoryboardImagesMediaInput,
  ImportShotVideoTakeInputMediaInput,
  ImportShotVideoTakeMediaInput,
  LocationMediaGenerationContextInput,
  ReadLookbookImageGenerationContextInput,
  ReadMediaGenerationSpecInput,
  ReadSceneStoryboardSheetGenerationContextInput,
  RunMediaGenerationSpecInput,
  ShotVideoTakeContextInput,
  ShotVideoTakeModelListInput,
  UpdateCastCharacterSheetGenerationSpecInput,
  UpdateCastProfileGenerationSpecInput,
  UpdateLocationEnvironmentSheetGenerationSpecInput,
  UpdateLookbookImageGenerationSpecInput,
  UpdateLookbookSheetGenerationSpecInput,
  UpdateSceneStoryboardSheetGenerationSpecInput,
  UpdateShotVideoTakeGenerationSpecInput,
  UpdateShotVideoTakeInputGenerationSpecInput,
  ValidateCastCharacterSheetGenerationSpecInput,
  ValidateCastProfileGenerationSpecInput,
  ValidateCastVoiceSampleGenerationSpecInput,
  ValidateLocationEnvironmentSheetGenerationSpecInput,
  ValidateLookbookSheetGenerationSpecInput,
  ValidateSceneStoryboardSheetGenerationSpecInput,
  ValidateSceneDialogueAudioGenerationSpecInput,
  ValidateShotVideoTakeGenerationSpecInput,
  ValidateShotVideoTakeInputGenerationSpecInput,
} from '../project-data-service-contracts.js';
import * as characterSheet from './cast-character-sheet.js';
import * as castProfile from './cast-profile.js';
import * as castVoiceSample from './cast-voice-sample.js';
import * as locationSheet from './location-environment-sheet.js';
import * as lookbookImage from './lookbook-image.js';
import * as lookbookSheet from './lookbook-sheet.js';
import * as sceneStoryboardSheet from './scene-storyboard-sheet.js';
import * as sceneDialogueAudio from './scene-dialogue-audio.js';
import { buildShotVideoTakeContext } from './shot-video-take/context.js';
import { listShotVideoTakeModels, listShotInputModels } from './shot-video-take/model-list.js';
import { validateShotFirstFrameSpec, validateShotLastFrameSpec, validateShotReferenceImageSpec, validateShotMultiShotStoryboardSheetSpec, createShotFirstFrameSpec, createShotLastFrameSpec, createShotReferenceImageSpec, createShotMultiShotStoryboardSheetSpec, updateShotFirstFrameSpec, updateShotLastFrameSpec, updateShotReferenceImageSpec, updateShotMultiShotStoryboardSheetSpec, listShotFirstFrameSpecs, listShotLastFrameSpecs, listShotReferenceImageSpecs, listShotMultiShotStoryboardSheetSpecs, prepareShotFirstFrameSpec, prepareShotLastFrameSpec, prepareShotReferenceImageSpec, prepareShotMultiShotStoryboardSheetSpec, prepareShotInputDraftSpec } from './shot-video-take/input-specs.js';
import { buildShotInputDependencyDraftSpec } from './shot-video-take/dependency-draft-specs.js';
import { validateShotVideoTakeSpec, createShotVideoTakeSpec, updateShotVideoTakeSpec, listShotVideoTakeSpecs, prepareShotVideoTakeSpec, prepareShotVideoTakeDraftSpec } from './shot-video-take/final-specs.js';
import { runShotFirstFrameSpec, runShotLastFrameSpec, runShotReferenceImageSpec, runShotMultiShotStoryboardSheetSpec, runShotVideoTakeSpec } from './shot-video-take/generation-runs.js';
import { declareShotVideoTakeDependencies } from './shot-video-take/dependency-inventory.js';
import { importShotFirstFrame, importShotLastFrame, importShotReferenceImage, importShotMultiShotStoryboardSheet, importShotVideoTake } from './shot-video-take/media-imports.js';
import type {
  MediaGenerationDependencyDraftPlan,
  MediaGenerationDependencyDraftSpecInput,
} from './dependency-draft-specs.js';

export type MediaGenerationContextReport =
  | LookbookImageGenerationContext
  | LookbookSheetGenerationContext
  | CastCharacterSheetGenerationContext
  | CastProfileGenerationContext
  | CastVoiceSampleGenerationContext
  | SceneDialogueAudioContext
  | LocationEnvironmentSheetGenerationContext
  | SceneStoryboardSheetGenerationContext
  | ShotVideoTakeGenerationContext;

export type MediaGenerationModelListReport =
  | LookbookImageModelListReport
  | LookbookSheetModelListReport
  | CastCharacterSheetModelListReport
  | CastProfileModelListReport
  | CastVoiceSampleModelListReport
  | SceneDialogueAudioModelListReport
  | LocationEnvironmentSheetModelListReport
  | SceneStoryboardSheetModelListReport
  | ShotVideoTakeInputModelListReport
  | ShotVideoTakeModelListReport;

export type MediaGenerationImportReport =
  | LookbookImageMediaImportReport
  | LookbookSheetMediaImportReport
  | CastMediaImportReport
  | LocationEnvironmentSheetMediaImportReport
  | SceneStoryboardImagesImportReport
  | ShotVideoTakeInputMediaImportReport
  | ShotVideoTakeMediaImportReport;

export interface MediaGenerationPurposeContextInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationRequestTarget;
  shotListId?: string;
  shotIds?: string[];
  inputModeId?: string;
}

export interface ListMediaGenerationSpecsInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationRequestTarget;
  shotListId?: string;
  shotIds?: string[];
}

export interface ValidateMediaGenerationSpecInput {
  projectName?: string;
  homeDir?: string;
  spec: MediaGenerationSpec;
}

export interface PrepareDraftMediaGenerationSpecInput extends ValidateMediaGenerationSpecInput {}

export interface CreateMediaGenerationSpecInput extends ValidateMediaGenerationSpecInput {
  idGenerator?: Parameters<typeof lookbookImage.createLookbookImageSpec>[0]['idGenerator'];
}

export interface UpdateMediaGenerationSpecInput extends ValidateMediaGenerationSpecInput {
  specId: string;
}

export interface MediaGenerationDependencyDeclarationInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  request: MediaGenerationDependencyRequest;
  parentLineId?: string;
}

export interface MediaGenerationPurposeDefinition {
  purpose: MediaGenerationPurpose;
  mediaKind: MediaKind;
  targetKind: MediaGenerationRequestTarget['kind'];
  buildContext(input: MediaGenerationPurposeContextInput): Promise<MediaGenerationContextReport>;
  listModels(input: MediaGenerationPurposeContextInput): Promise<MediaGenerationModelListReport>;
  validateSpec(
    input: ValidateMediaGenerationSpecInput
  ): Promise<{ valid: true; spec: MediaGenerationSpec; providerPayload: Record<string, unknown> }>;
  createSpec(input: CreateMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  updateSpec(input: UpdateMediaGenerationSpecInput): Promise<MediaGenerationSpecRecord>;
  listSpecs(input: ListMediaGenerationSpecsInput): Promise<{ specs: MediaGenerationSpecRecord[] }>;
  prepareSpec(input: ReadMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  prepareDraftSpec(input: PrepareDraftMediaGenerationSpecInput): Promise<PreparedMediaGeneration>;
  declareDependencies?(
    input: MediaGenerationDependencyDeclarationInput
  ): Promise<MediaGenerationDependencySlot[]>;
  planDependencyDraft?(
    input: MediaGenerationDependencyDraftSpecInput
  ): Promise<MediaGenerationDependencyDraftPlan>;
  runSpec(input: RunMediaGenerationSpecInput): Promise<unknown>;
}

const DEFINITIONS = [
  {
    purpose: LOOKBOOK_IMAGE_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'lookbook',
    buildContext: (input) =>
      lookbookImage.buildLookbookImageContext(toLookbookInput(input)),
    listModels: (input) => lookbookImage.listLookbookImageModels(toLookbookInput(input)),
    validateSpec: (input) =>
      lookbookImage.validateLookbookImageSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LookbookImageGenerationSpec,
      }),
    createSpec: (input) =>
      lookbookImage.createLookbookImageSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LookbookImageGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateLookbookImageGenerationSpecInput),
    updateSpec: (input) =>
      lookbookImage.updateLookbookImageSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as LookbookImageGenerationSpec,
      } satisfies UpdateLookbookImageGenerationSpecInput),
    listSpecs: (input) => lookbookImage.listLookbookImageSpecs(toLookbookInput(input)),
    prepareSpec: lookbookImage.prepareLookbookImageSpec,
    prepareDraftSpec: (input) =>
      lookbookImage.prepareLookbookImageDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LookbookImageGenerationSpec,
      }),
    runSpec: lookbookImage.runLookbookImageSpec,
  },
  {
    purpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'lookbook',
    buildContext: (input) =>
      lookbookSheet.buildLookbookSheetContext(toLookbookInput(input)),
    listModels: (input) => lookbookSheet.listLookbookSheetModels(toLookbookInput(input)),
    validateSpec: (input) =>
      lookbookSheet.validateLookbookSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LookbookSheetGenerationSpec,
      } satisfies ValidateLookbookSheetGenerationSpecInput),
    createSpec: (input) =>
      lookbookSheet.createLookbookSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LookbookSheetGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateLookbookSheetGenerationSpecInput),
    updateSpec: (input) =>
      lookbookSheet.updateLookbookSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as LookbookSheetGenerationSpec,
      } satisfies UpdateLookbookSheetGenerationSpecInput),
    listSpecs: (input) => lookbookSheet.listLookbookSheetSpecs(toLookbookInput(input)),
    prepareSpec: lookbookSheet.prepareLookbookSheetSpec,
    prepareDraftSpec: (input) =>
      lookbookSheet.prepareLookbookSheetDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LookbookSheetGenerationSpec,
      }),
    planDependencyDraft: lookbookSheet.buildLookbookSheetDependencyDraftSpec,
    runSpec: lookbookSheet.runLookbookSheetSpec,
  },
  {
    purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'castMember',
    buildContext: (input) =>
      characterSheet.buildCastCharacterSheetContext(toCastInput(input)),
    listModels: (input) => characterSheet.listCastCharacterSheetModels(toCastInput(input)),
    validateSpec: (input) =>
      characterSheet.validateCastCharacterSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastCharacterSheetGenerationSpec,
      } satisfies ValidateCastCharacterSheetGenerationSpecInput),
    createSpec: (input) =>
      characterSheet.createCastCharacterSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastCharacterSheetGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateCastCharacterSheetGenerationSpecInput),
    updateSpec: (input) =>
      characterSheet.updateCastCharacterSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as CastCharacterSheetGenerationSpec,
      } satisfies UpdateCastCharacterSheetGenerationSpecInput),
    listSpecs: (input) => characterSheet.listCastCharacterSheetSpecs(toCastInput(input)),
    prepareSpec: characterSheet.prepareCastCharacterSheetSpec,
    prepareDraftSpec: (input) =>
      characterSheet.prepareCastCharacterSheetDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastCharacterSheetGenerationSpec,
      }),
    planDependencyDraft: characterSheet.buildCastCharacterSheetDependencyDraftSpec,
    runSpec: characterSheet.runCastCharacterSheetSpec,
  },
  {
    purpose: CAST_PROFILE_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'castMember',
    buildContext: (input) => castProfile.buildCastProfileContext(toCastInput(input)),
    listModels: (input) => castProfile.listCastProfileModels(toCastInput(input)),
    validateSpec: (input) =>
      castProfile.validateCastProfileSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastProfileGenerationSpec,
      } satisfies ValidateCastProfileGenerationSpecInput),
    createSpec: (input) =>
      castProfile.createCastProfileSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastProfileGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateCastProfileGenerationSpecInput),
    updateSpec: (input) =>
      castProfile.updateCastProfileSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as CastProfileGenerationSpec,
      } satisfies UpdateCastProfileGenerationSpecInput),
    listSpecs: (input) => castProfile.listCastProfileSpecs(toCastInput(input)),
    prepareSpec: castProfile.prepareCastProfileSpec,
    prepareDraftSpec: (input) =>
      castProfile.prepareCastProfileDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastProfileGenerationSpec,
      }),
    declareDependencies: castProfile.declareCastProfileDependencies,
    runSpec: castProfile.runCastProfileSpec,
  },
  {
    purpose: CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
    mediaKind: 'audio',
    targetKind: 'castMember',
    buildContext: (input) =>
      castVoiceSample.buildCastVoiceSampleContext(toCastInput(input)),
    listModels: (input) =>
      castVoiceSample.listCastVoiceSampleModels(toCastInput(input)),
    validateSpec: (input) =>
      castVoiceSample.validateCastVoiceSampleSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastVoiceSampleGenerationSpec,
      } satisfies ValidateCastVoiceSampleGenerationSpecInput),
    createSpec: (input) =>
      castVoiceSample.createCastVoiceSampleSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastVoiceSampleGenerationSpec,
        idGenerator: input.idGenerator,
      }),
    updateSpec: (input) =>
      castVoiceSample.updateCastVoiceSampleSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as CastVoiceSampleGenerationSpec,
      }),
    listSpecs: (input) => castVoiceSample.listCastVoiceSampleSpecs(toCastInput(input)),
    prepareSpec: castVoiceSample.prepareCastVoiceSampleSpec,
    prepareDraftSpec: (input) =>
      castVoiceSample.prepareCastVoiceSampleDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastVoiceSampleGenerationSpec,
      }),
    runSpec: castVoiceSample.runCastVoiceSampleSpec,
  },
  {
    purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
    mediaKind: 'audio',
    targetKind: 'sceneDialogue',
    buildContext: (input) =>
      sceneDialogueAudio.readSceneDialogueAudioContext({
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: requireTargetKind(input, 'sceneDialogue').sceneId,
        dialogueId: requireTargetKind(input, 'sceneDialogue').dialogueId,
      }),
    listModels: (input) =>
      sceneDialogueAudio.listSceneDialogueAudioModels({
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: requireTargetKind(input, 'sceneDialogue').sceneId,
        dialogueId: requireTargetKind(input, 'sceneDialogue').dialogueId,
      }),
    validateSpec: (input) =>
      sceneDialogueAudio.validateSceneDialogueAudioSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneDialogueAudioGenerationSpec,
      } satisfies ValidateSceneDialogueAudioGenerationSpecInput),
    createSpec: (input) =>
      sceneDialogueAudio.createSceneDialogueAudioSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneDialogueAudioGenerationSpec,
        idGenerator: input.idGenerator,
      }),
    updateSpec: (input) =>
      sceneDialogueAudio.updateSceneDialogueAudioSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as SceneDialogueAudioGenerationSpec,
      }),
    listSpecs: (input) =>
      sceneDialogueAudio.listSceneDialogueAudioSpecs({
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: requireTargetKind(input, 'sceneDialogue').sceneId,
        dialogueId: requireTargetKind(input, 'sceneDialogue').dialogueId,
      }),
    prepareSpec: sceneDialogueAudio.prepareSceneDialogueAudioSpec,
    prepareDraftSpec: (input) =>
      sceneDialogueAudio.prepareSceneDialogueAudioDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneDialogueAudioGenerationSpec,
      }),
    planDependencyDraft:
      sceneDialogueAudio.buildSceneDialogueAudioDependencyDraftSpec,
    runSpec: sceneDialogueAudio.runSceneDialogueAudioSpec,
  },
  {
    purpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'location',
    buildContext: (input) =>
      locationSheet.buildLocationEnvironmentSheetContext(toLocationInput(input)),
    listModels: (input) =>
      locationSheet.listLocationEnvironmentSheetModels(toLocationInput(input)),
    validateSpec: (input) =>
      locationSheet.validateLocationEnvironmentSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LocationEnvironmentSheetGenerationSpec,
      } satisfies ValidateLocationEnvironmentSheetGenerationSpecInput),
    createSpec: (input) =>
      locationSheet.createLocationEnvironmentSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LocationEnvironmentSheetGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateLocationEnvironmentSheetGenerationSpecInput),
    updateSpec: (input) =>
      locationSheet.updateLocationEnvironmentSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as LocationEnvironmentSheetGenerationSpec,
      } satisfies UpdateLocationEnvironmentSheetGenerationSpecInput),
    listSpecs: (input) => locationSheet.listLocationEnvironmentSheetSpecs(toLocationInput(input)),
    prepareSpec: locationSheet.prepareLocationEnvironmentSheetSpec,
    prepareDraftSpec: (input) =>
      locationSheet.prepareLocationEnvironmentSheetDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LocationEnvironmentSheetGenerationSpec,
      }),
    planDependencyDraft:
      locationSheet.buildLocationEnvironmentSheetDependencyDraftSpec,
    runSpec: locationSheet.runLocationEnvironmentSheetSpec,
  },
  {
    purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'scene',
    buildContext: (input) =>
      sceneStoryboardSheet.buildSceneStoryboardSheetContext(toSceneInput(input)),
    listModels: (input) =>
      sceneStoryboardSheet.listSceneStoryboardSheetModels(toSceneInput(input)),
    validateSpec: (input) =>
      sceneStoryboardSheet.validateSceneStoryboardSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneStoryboardSheetGenerationSpec,
      } satisfies ValidateSceneStoryboardSheetGenerationSpecInput),
    createSpec: (input) =>
      sceneStoryboardSheet.createSceneStoryboardSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneStoryboardSheetGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateSceneStoryboardSheetGenerationSpecInput),
    updateSpec: (input) =>
      sceneStoryboardSheet.updateSceneStoryboardSheetSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as SceneStoryboardSheetGenerationSpec,
      } satisfies UpdateSceneStoryboardSheetGenerationSpecInput),
    listSpecs: (input) => sceneStoryboardSheet.listSceneStoryboardSheetSpecs(toSceneInput(input)),
    prepareSpec: sceneStoryboardSheet.prepareSceneStoryboardSheetSpec,
    prepareDraftSpec: (input) =>
      sceneStoryboardSheet.prepareSceneStoryboardSheetDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneStoryboardSheetGenerationSpec,
      }),
    runSpec: sceneStoryboardSheet.runSceneStoryboardSheetSpec,
  },
  {
    purpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotGroup',
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) =>
      listShotInputModels(
        toShotInput(input),
        SHOT_FIRST_FRAME_GENERATION_PURPOSE
      ),
    validateSpec: (input) =>
      validateShotFirstFrameSpec(toShotInputSpecValidation(input)),
    createSpec: (input) =>
      createShotFirstFrameSpec(toShotInputSpecCreation(input)),
    updateSpec: (input) =>
      updateShotFirstFrameSpec(toShotInputSpecUpdate(input)),
    listSpecs: (input) => listShotFirstFrameSpecs(toShotInput(input)),
    prepareSpec: prepareShotFirstFrameSpec,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotFirstFrameSpec,
  },
  {
    purpose: SHOT_LAST_FRAME_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotGroup',
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) =>
      listShotInputModels(
        toShotInput(input),
        SHOT_LAST_FRAME_GENERATION_PURPOSE
      ),
    validateSpec: (input) =>
      validateShotLastFrameSpec(toShotInputSpecValidation(input)),
    createSpec: (input) =>
      createShotLastFrameSpec(toShotInputSpecCreation(input)),
    updateSpec: (input) =>
      updateShotLastFrameSpec(toShotInputSpecUpdate(input)),
    listSpecs: (input) => listShotLastFrameSpecs(toShotInput(input)),
    prepareSpec: prepareShotLastFrameSpec,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotLastFrameSpec,
  },
  {
    purpose: SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotGroup',
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) =>
      listShotInputModels(
        toShotInput(input),
        SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE
      ),
    validateSpec: (input) =>
      validateShotReferenceImageSpec(toShotInputSpecValidation(input)),
    createSpec: (input) =>
      createShotReferenceImageSpec(toShotInputSpecCreation(input)),
    updateSpec: (input) =>
      updateShotReferenceImageSpec(toShotInputSpecUpdate(input)),
    listSpecs: (input) => listShotReferenceImageSpecs(toShotInput(input)),
    prepareSpec: prepareShotReferenceImageSpec,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotReferenceImageSpec,
  },
  {
    purpose: SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotGroup',
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) =>
      listShotInputModels(
        toShotInput(input),
        SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE
      ),
    validateSpec: (input) =>
      validateShotMultiShotStoryboardSheetSpec(toShotInputSpecValidation(input)),
    createSpec: (input) =>
      createShotMultiShotStoryboardSheetSpec(toShotInputSpecCreation(input)),
    updateSpec: (input) =>
      updateShotMultiShotStoryboardSheetSpec(toShotInputSpecUpdate(input)),
    listSpecs: (input) =>
      listShotMultiShotStoryboardSheetSpecs(toShotInput(input)),
    prepareSpec: prepareShotMultiShotStoryboardSheetSpec,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotMultiShotStoryboardSheetSpec,
  },
  {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    mediaKind: 'video',
    targetKind: 'sceneShotGroup',
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) => listShotVideoTakeModels(toShotModelInput(input)),
    validateSpec: (input) =>
      validateShotVideoTakeSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeGenerationSpec,
      } satisfies ValidateShotVideoTakeGenerationSpecInput),
    createSpec: (input) =>
      createShotVideoTakeSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateShotVideoTakeGenerationSpecInput),
    updateSpec: (input) =>
      updateShotVideoTakeSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as ShotVideoTakeGenerationSpec,
      } satisfies UpdateShotVideoTakeGenerationSpecInput),
    listSpecs: (input) => listShotVideoTakeSpecs(toShotInput(input)),
    prepareSpec: prepareShotVideoTakeSpec,
    prepareDraftSpec: (input) =>
      prepareShotVideoTakeDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeGenerationSpec,
      }),
    declareDependencies: declareShotVideoTakeDependencies,
    runSpec: runShotVideoTakeSpec,
  },
] satisfies MediaGenerationPurposeDefinition[];

const DEFINITIONS_BY_PURPOSE = new Map<MediaGenerationPurpose, MediaGenerationPurposeDefinition>(
  DEFINITIONS.map((definition) => [definition.purpose, definition])
);

export function listMediaGenerationPurposeDefinitions(): MediaGenerationPurposeDefinition[] {
  return [...DEFINITIONS];
}

export function requireMediaGenerationPurposeDefinition(
  purpose: string
): MediaGenerationPurposeDefinition {
  const definition = DEFINITIONS_BY_PURPOSE.get(purpose as MediaGenerationPurpose);
  if (!definition) {
    throw new ProjectDataError(
      'PROJECT_DATA387',
      `Unsupported media generation purpose: ${purpose}.`,
      {
        suggestion:
          'Use one of the registered media generation purposes from the core purpose registry.',
      }
    );
  }
  return definition;
}

export function assertRegisteredMediaGenerationPurpose(
  purpose: string
): asserts purpose is MediaGenerationPurpose {
  requireMediaGenerationPurposeDefinition(purpose);
}

function requireTargetKind<T extends MediaGenerationRequestTarget['kind']>(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput,
  kind: T
): Extract<MediaGenerationRequestTarget, { kind: T }> {
  if (input.target.kind !== kind) {
    throw new ProjectDataError(
      'PROJECT_DATA388',
      `Media generation purpose ${input.purpose} requires target.kind "${kind}". Received: ${input.target.kind}.`
    );
  }
  return input.target as Extract<MediaGenerationRequestTarget, { kind: T }>;
}

function toLookbookInput(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): ReadLookbookImageGenerationContextInput {
  const target = requireTargetKind(input, 'lookbook');
  return { projectName: input.projectName, homeDir: input.homeDir, lookbookId: target.id };
}

function toCastInput(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): CastMediaGenerationContextInput {
  const target = requireTargetKind(input, 'castMember');
  return { projectName: input.projectName, homeDir: input.homeDir, castMemberId: target.id };
}

function toLocationInput(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): LocationMediaGenerationContextInput {
  const target = requireTargetKind(input, 'location');
  return { projectName: input.projectName, homeDir: input.homeDir, locationId: target.id };
}

function toSceneInput(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): ReadSceneStoryboardSheetGenerationContextInput {
  const target = requireTargetKind(input, 'scene');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: target.id,
    shotListId: requireShotListId(input),
  };
}

function toShotInput(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): ShotVideoTakeContextInput {
  const target = requireTargetKind(input, 'sceneShotGroup');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: target.sceneId,
    shotListId: input.shotListId ?? target.shotListId,
    shotIds: input.shotIds ?? target.shotIds,
    ...(target.productionGroupId
      ? { productionGroupId: target.productionGroupId }
      : {}),
  };
}

function toShotModelInput(input: MediaGenerationPurposeContextInput): ShotVideoTakeModelListInput {
  return {
    ...toShotInput(input),
    ...(input.inputModeId ? { inputModeId: input.inputModeId as never } : {}),
  };
}

function toShotInputSpecValidation(
  input: ValidateMediaGenerationSpecInput
): ValidateShotVideoTakeInputGenerationSpecInput {
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as ShotVideoTakeInputGenerationSpec,
  };
}

function toShotInputSpecCreation(
  input: CreateMediaGenerationSpecInput
): CreateShotVideoTakeInputGenerationSpecInput {
  return {
    ...toShotInputSpecValidation(input),
    idGenerator: input.idGenerator,
  };
}

function toShotInputSpecUpdate(
  input: UpdateMediaGenerationSpecInput
): UpdateShotVideoTakeInputGenerationSpecInput {
  return {
    ...toShotInputSpecValidation(input),
    specId: input.specId,
  };
}

function requireShotListId(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): string {
  if (!input.shotListId) {
    throw new ProjectDataError(
      'PROJECT_DATA389',
      `Media generation purpose ${input.purpose} requires shotListId.`
    );
  }
  return input.shotListId;
}

export async function importMediaGenerationByPurpose(input:
  | ({ purpose: typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE } & ImportLookbookImageMediaInput)
  | ({ purpose: typeof LOOKBOOK_SHEET_GENERATION_PURPOSE } & ImportLookbookSheetMediaInput)
  | ({ purpose: typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE } & ImportCastMediaInput)
  | ({ purpose: typeof CAST_PROFILE_GENERATION_PURPOSE } & ImportCastMediaInput)
  | ({ purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE } & ImportLocationEnvironmentSheetMediaInput)
  | ({ purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE } & ImportSceneStoryboardImagesMediaInput)
  | ({ purpose: typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_LAST_FRAME_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE } & ImportShotVideoTakeMediaInput)
): Promise<MediaGenerationImportReport> {
  switch (input.purpose) {
    case LOOKBOOK_IMAGE_GENERATION_PURPOSE:
      return lookbookImage.importLookbookImageMedia(input);
    case LOOKBOOK_SHEET_GENERATION_PURPOSE:
      return lookbookSheet.importLookbookSheetMedia(input);
    case CAST_CHARACTER_SHEET_GENERATION_PURPOSE:
      return characterSheet.importCastCharacterSheetMedia(input);
    case CAST_PROFILE_GENERATION_PURPOSE:
      return castProfile.importCastProfileMedia(input);
    case LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE:
      return locationSheet.importLocationEnvironmentSheetMedia(input);
    case SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return sceneStoryboardSheet.importSceneStoryboardImagesMedia(input);
    case SHOT_FIRST_FRAME_GENERATION_PURPOSE:
      return importShotFirstFrame(input);
    case SHOT_LAST_FRAME_GENERATION_PURPOSE:
      return importShotLastFrame(input);
    case SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE:
      return importShotReferenceImage(input);
    case SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return importShotMultiShotStoryboardSheet(input);
    case SHOT_VIDEO_TAKE_GENERATION_PURPOSE:
      return importShotVideoTake(input);
    default:
      return assertNever(input);
  }
}

function assertNever(value: never): never {
  throw new ProjectDataError(
    'PROJECT_DATA387',
    `Unsupported media generation purpose: ${(value as { purpose: string }).purpose}.`
  );
}
