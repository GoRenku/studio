import type {
  AgentMediaReport,
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
  LocationHeroGenerationContext,
  LocationHeroGenerationSpec,
  LocationHeroMediaImportReport,
  LocationHeroModelListReport,
  LookbookImageGenerationContext,
  LookbookImageGenerationSpec,
  LookbookImageMediaImportReport,
  LookbookImageModelListReport,
  LookbookSheetGenerationContext,
  LookbookSheetGenerationSpec,
  LookbookSheetMediaImportReport,
  LookbookSheetModelListReport,
  GenerationPreviewRequest,
  MediaGenerationPurpose,
  MediaGenerationCostProjection,
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
  ShotVideoTakeProductionContext,
  ShotVideoTakeOutputGenerationSpec,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeInputMediaImportReport,
  ShotVideoTakeMediaImportReport,
  ShotVideoTakeInputModelListReport,
  ShotVideoTakeModelListReport,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type {
  CastMediaGenerationContextInput,
  CreateCastCharacterSheetGenerationSpecInput,
  CreateCastProfileGenerationSpecInput,
  CreateLocationEnvironmentSheetGenerationSpecInput,
  CreateLocationHeroGenerationSpecInput,
  CreateLookbookImageGenerationSpecInput,
  CreateLookbookSheetGenerationSpecInput,
  CreateSceneStoryboardSheetGenerationSpecInput,
  CreateShotVideoTakeOutputGenerationSpecInput,
  CreateShotVideoTakeInputGenerationSpecInput,
  ImportCastMediaInput,
  ImportLocationEnvironmentSheetMediaInput,
  ImportLocationHeroMediaInput,
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
  UpdateLocationHeroGenerationSpecInput,
  UpdateLookbookImageGenerationSpecInput,
  UpdateLookbookSheetGenerationSpecInput,
  UpdateSceneStoryboardSheetGenerationSpecInput,
  UpdateShotVideoTakeOutputGenerationSpecInput,
  UpdateShotVideoTakeInputGenerationSpecInput,
  ValidateCastCharacterSheetGenerationSpecInput,
  ValidateCastProfileGenerationSpecInput,
  ValidateCastVoiceSampleGenerationSpecInput,
  ValidateLocationEnvironmentSheetGenerationSpecInput,
  ValidateLocationHeroGenerationSpecInput,
  ValidateLookbookSheetGenerationSpecInput,
  ValidateSceneStoryboardSheetGenerationSpecInput,
  ValidateSceneDialogueAudioGenerationSpecInput,
  ValidateShotVideoTakeOutputGenerationSpecInput,
  ValidateShotVideoTakeInputGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import * as characterSheet from '../purposes/cast-character-sheet.js';
import * as castProfile from '../purposes/cast-profile.js';
import * as castVoiceSample from '../purposes/cast-voice-sample.js';
import * as locationSheet from '../purposes/location-environment-sheet.js';
import * as locationHero from '../purposes/location-hero.js';
import * as lookbookImage from '../purposes/lookbook-image.js';
import * as lookbookSheet from '../purposes/lookbook-sheet.js';
import * as sceneStoryboardSheet from '../purposes/scene-storyboard-sheet.js';
import * as sceneDialogueAudio from '../purposes/scene-dialogue-audio.js';
import { buildMediaGenerationCostProjection } from '../cost/cost-projection.js';
import { buildShotVideoTakeContext } from '../purposes/shot-video-take/authoring/context.js';
import { listShotVideoTakeModels, listShotInputModels } from '../purposes/shot-video-take/specs/model-list.js';
import { validateShotFirstFrameSpec, validateShotLastFrameSpec, validateShotReferenceImageSpec, validateShotVideoPromptSheetSpec, createShotFirstFrameSpec, createShotLastFrameSpec, createShotReferenceImageSpec, createShotVideoPromptSheetSpec, updateShotFirstFrameSpec, updateShotLastFrameSpec, updateShotReferenceImageSpec, updateShotVideoPromptSheetSpec, listShotFirstFrameSpecs, listShotLastFrameSpecs, listShotReferenceImageSpecs, listShotVideoPromptSheetSpecs, prepareShotFirstFrameSpec, prepareShotLastFrameSpec, prepareShotReferenceImageSpec, prepareShotVideoPromptSheetSpec, buildShotInputGenerationPreview, prepareShotInputDraftSpec } from '../purposes/shot-video-take/specs/input-specs.js';
import { buildShotInputDependencyDraftSpec } from '../purposes/shot-video-take/planning/dependency-draft-specs.js';
import { declareShotVideoInputDependencies } from '../purposes/shot-video-take/planning/shot-input-dependencies.js';
import { validateShotVideoTakeSpec, createShotVideoTakeSpec, updateShotVideoTakeSpec, listShotVideoTakeSpecs, prepareShotVideoTakeSpec, buildShotVideoTakeGenerationPreview, prepareShotVideoTakeDraftSpec } from '../purposes/shot-video-take/specs/final-specs.js';
import { runShotFirstFrameSpec, runShotLastFrameSpec, runShotReferenceImageSpec, runShotVideoPromptSheetSpec, runShotVideoTakeSpec } from '../purposes/shot-video-take/runs/generation-runs.js';
import { declareShotVideoTakeDependencies } from '../purposes/shot-video-take/planning/dependency-inventory.js';
import { importShotFirstFrame, importShotLastFrame, importShotReferenceImage, importShotVideoPromptSheet, importShotVideoTake } from '../purposes/shot-video-take/imports/media-imports.js';
import type {
  MediaGenerationDependencyDraftPlan,
  MediaGenerationDependencyDraftSpecInput,
} from '../dependencies/dependency-draft-specs.js';

export type MediaGenerationContextReport =
  | LookbookImageGenerationContext
  | LookbookSheetGenerationContext
  | CastCharacterSheetGenerationContext
  | CastProfileGenerationContext
  | CastVoiceSampleGenerationContext
  | SceneDialogueAudioContext
  | LocationEnvironmentSheetGenerationContext
  | LocationHeroGenerationContext
  | SceneStoryboardSheetGenerationContext
  | ShotVideoTakeProductionContext;

export type AgentAwareMediaGenerationContextReport =
  MediaGenerationContextReport & { agentMedia?: AgentMediaReport };

export type MediaGenerationModelListReport =
  | LookbookImageModelListReport
  | LookbookSheetModelListReport
  | CastCharacterSheetModelListReport
  | CastProfileModelListReport
  | CastVoiceSampleModelListReport
  | SceneDialogueAudioModelListReport
  | LocationEnvironmentSheetModelListReport
  | LocationHeroModelListReport
  | SceneStoryboardSheetModelListReport
  | ShotVideoTakeInputModelListReport
  | ShotVideoTakeModelListReport;

export type AgentAwareMediaGenerationModelListReport =
  MediaGenerationModelListReport & { agentMedia?: AgentMediaReport };

export type MediaGenerationImportReport =
  | LookbookImageMediaImportReport
  | LookbookSheetMediaImportReport
  | CastMediaImportReport
  | LocationEnvironmentSheetMediaImportReport
  | LocationHeroMediaImportReport
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

export interface MediaGenerationCostProjectionInput extends ValidateMediaGenerationSpecInput {}

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
  buildCostProjection(
    input: MediaGenerationCostProjectionInput
  ): Promise<MediaGenerationCostProjection>;
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
  buildPreview?(input: ReadMediaGenerationSpecInput): Promise<GenerationPreviewRequest>;
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
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: lookbookImage.buildLookbookImageGenerationPreview,
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
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: lookbookSheet.buildLookbookSheetGenerationPreview,
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
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: characterSheet.buildCastCharacterSheetGenerationPreview,
    prepareDraftSpec: (input) =>
      characterSheet.prepareCastCharacterSheetDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as CastCharacterSheetGenerationSpec,
      }),
    declareDependencies: characterSheet.declareCastCharacterSheetDependencies,
    planDependencyDraft: characterSheet.buildCastCharacterSheetDependencyDraftSpec,
    runSpec: characterSheet.runCastCharacterSheetSpec,
  },
  {
    purpose: CAST_PROFILE_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'castMember',
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: castProfile.buildCastProfileGenerationPreview,
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
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: locationSheet.buildLocationEnvironmentSheetGenerationPreview,
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
    purpose: LOCATION_HERO_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'location',
    buildCostProjection: buildMediaGenerationCostProjection,
    buildContext: (input) =>
      locationHero.buildLocationHeroContext(toLocationHeroInput(input)),
    listModels: (input) =>
      locationHero.listLocationHeroModels(toLocationHeroInput(input)),
    validateSpec: (input) =>
      locationHero.validateLocationHeroSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LocationHeroGenerationSpec,
      } satisfies ValidateLocationHeroGenerationSpecInput),
    createSpec: (input) =>
      locationHero.createLocationHeroSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LocationHeroGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateLocationHeroGenerationSpecInput),
    updateSpec: (input) =>
      locationHero.updateLocationHeroSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as LocationHeroGenerationSpec,
      } satisfies UpdateLocationHeroGenerationSpecInput),
    listSpecs: (input) => locationHero.listLocationHeroSpecs(toLocationInput(input)),
    prepareSpec: locationHero.prepareLocationHeroSpec,
    buildPreview: locationHero.buildLocationHeroGenerationPreview,
    prepareDraftSpec: (input) =>
      locationHero.prepareLocationHeroDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as LocationHeroGenerationSpec,
      }),
    runSpec: locationHero.runLocationHeroSpec,
  },
  {
    purpose: SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'scene',
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: sceneStoryboardSheet.buildSceneStoryboardSheetGenerationPreview,
    prepareDraftSpec: (input) =>
      sceneStoryboardSheet.prepareSceneStoryboardSheetDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as SceneStoryboardSheetGenerationSpec,
      }),
    declareDependencies:
      sceneStoryboardSheet.declareSceneStoryboardSheetDependencies,
    runSpec: sceneStoryboardSheet.runSceneStoryboardSheetSpec,
  },
  {
    purpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotVideoTake',
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: buildShotInputGenerationPreview,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    declareDependencies: declareShotVideoInputDependencies,
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotFirstFrameSpec,
  },
  {
    purpose: SHOT_LAST_FRAME_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotVideoTake',
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: buildShotInputGenerationPreview,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    declareDependencies: declareShotVideoInputDependencies,
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotLastFrameSpec,
  },
  {
    purpose: SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotVideoTake',
    buildCostProjection: buildMediaGenerationCostProjection,
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
    buildPreview: buildShotInputGenerationPreview,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    declareDependencies: declareShotVideoInputDependencies,
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotReferenceImageSpec,
  },
  {
    purpose: SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
    mediaKind: 'image',
    targetKind: 'sceneShotVideoTake',
    buildCostProjection: buildMediaGenerationCostProjection,
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) =>
      listShotInputModels(
        toShotInput(input),
        SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE
      ),
    validateSpec: (input) =>
      validateShotVideoPromptSheetSpec(toShotInputSpecValidation(input)),
    createSpec: (input) =>
      createShotVideoPromptSheetSpec(toShotInputSpecCreation(input)),
    updateSpec: (input) =>
      updateShotVideoPromptSheetSpec(toShotInputSpecUpdate(input)),
    listSpecs: (input) =>
      listShotVideoPromptSheetSpecs(toShotInput(input)),
    prepareSpec: prepareShotVideoPromptSheetSpec,
    buildPreview: buildShotInputGenerationPreview,
    prepareDraftSpec: (input) =>
      prepareShotInputDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeInputGenerationSpec,
      }),
    declareDependencies: declareShotVideoInputDependencies,
    planDependencyDraft: buildShotInputDependencyDraftSpec,
    runSpec: runShotVideoPromptSheetSpec,
  },
  {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    mediaKind: 'video',
    targetKind: 'sceneShotVideoTake',
    buildCostProjection: buildMediaGenerationCostProjection,
    buildContext: (input) => buildShotVideoTakeContext(toShotInput(input)),
    listModels: (input) => listShotVideoTakeModels(toShotModelInput(input)),
    validateSpec: (input) =>
      validateShotVideoTakeSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeOutputGenerationSpec,
      } satisfies ValidateShotVideoTakeOutputGenerationSpecInput),
    createSpec: (input) =>
      createShotVideoTakeSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeOutputGenerationSpec,
        idGenerator: input.idGenerator,
      } satisfies CreateShotVideoTakeOutputGenerationSpecInput),
    updateSpec: (input) =>
      updateShotVideoTakeSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        specId: input.specId,
        spec: input.spec as ShotVideoTakeOutputGenerationSpec,
      } satisfies UpdateShotVideoTakeOutputGenerationSpecInput),
    listSpecs: (input) => listShotVideoTakeSpecs(toShotInput(input)),
    prepareSpec: prepareShotVideoTakeSpec,
    buildPreview: buildShotVideoTakeGenerationPreview,
    prepareDraftSpec: (input) =>
      prepareShotVideoTakeDraftSpec({
        projectName: input.projectName,
        homeDir: input.homeDir,
        spec: input.spec as ShotVideoTakeOutputGenerationSpec,
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

function toLocationHeroInput(
  input: MediaGenerationPurposeContextInput | ListMediaGenerationSpecsInput
): locationHero.LocationHeroTargetInput {
  const target = requireTargetKind(input, 'location');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: target.id,
  };
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
  const target = requireTargetKind(input, 'sceneShotVideoTake');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: target.sceneId,
    takeId: target.takeId,
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
  | ({ purpose: typeof LOCATION_HERO_GENERATION_PURPOSE } & ImportLocationHeroMediaInput)
  | ({ purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE } & ImportSceneStoryboardImagesMediaInput)
  | ({ purpose: typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_LAST_FRAME_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE } & ImportShotVideoTakeInputMediaInput)
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
    case LOCATION_HERO_GENERATION_PURPOSE:
      return locationHero.importLocationHeroMedia(input);
    case SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return sceneStoryboardSheet.importSceneStoryboardImagesMedia(input);
    case SHOT_FIRST_FRAME_GENERATION_PURPOSE:
      return importShotFirstFrame(input);
    case SHOT_LAST_FRAME_GENERATION_PURPOSE:
      return importShotLastFrame(input);
    case SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE:
      return importShotReferenceImage(input);
    case SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE:
      return importShotVideoPromptSheet(input);
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
