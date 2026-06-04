import type { GenerationEstimate } from '@gorenku/studio-engines';
import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { Location } from './locations.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project.js';
import type {
  SceneShotListContextReport,
  SceneShotListDocument,
  SceneShotListSummary,
  SceneShot,
  LocationAzimuthViewId,
  ShotVideoTakePromptDraft,
  ShotVideoTakeDependencyKind,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeIntentId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeParameterValues,
  ShotVideoTakeProductionGroup,
} from './scene-shot-list.js';
import type { SceneSetting } from './screenplay.js';
import type { Lookbook, LookbookImage, LookbookSection } from './visual-language.js';
import type { InspirationFolderWithResolvedPath } from './visual-language.js';

export const LOOKBOOK_IMAGE_GENERATION_PURPOSE = 'lookbook.image' as const;
export const CAST_CHARACTER_SHEET_GENERATION_PURPOSE =
  'cast.character-sheet' as const;
export const CAST_PROFILE_GENERATION_PURPOSE = 'cast.profile' as const;
export const LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE =
  'location.environment-sheet' as const;
export const SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE =
  'scene.storyboard-sheet' as const;
export const SHOT_FIRST_FRAME_GENERATION_PURPOSE =
  'shot.first-frame' as const;
export const SHOT_LAST_FRAME_GENERATION_PURPOSE =
  'shot.last-frame' as const;
export const SHOT_REFERENCE_SHEET_GENERATION_PURPOSE =
  'shot.reference-sheet' as const;
export const SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE =
  'shot.multi-shot-storyboard-sheet' as const;
export const SHOT_VIDEO_TAKE_GENERATION_PURPOSE =
  'shot.video-take' as const;

export type MediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export type MediaGenerationPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE
  | typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE
  | typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE
  | typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_LAST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_REFERENCE_SHEET_GENERATION_PURPOSE
  | typeof SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE
  | typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;

export type MediaGenerationDependencyKind =
  | 'first-frame'
  | 'last-frame'
  | 'shot-reference-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'cast-character-sheet'
  | 'location-environment-sheet'
  | 'lookbook-reference-image'
  | 'manual-attachment';

export type LookbookImageModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image'
  | 'fal-ai/bytedance/seedream/v5/lite/text-to-image';

export type LookbookImageFrame =
  | 'project'
  | '1:1'
  | '3:4'
  | '4:3'
  | '16:9'
  | '9:16'
  | '21:9';

export type LookbookImageDetail = 'draft' | 'standard' | 'high';

export type LookbookImageOutputFormat = 'png' | 'jpeg' | 'webp';

export type CastImageFrame = LookbookImageFrame;
export type CastImageDetail = LookbookImageDetail;
export type CastImageOutputFormat = LookbookImageOutputFormat;

export type LocationEnvironmentViewFrame = '16:9';
export type LocationEnvironmentSheetFrame = '4:3';
export type LocationEnvironmentSheetDetail = 'draft' | 'standard' | 'high';
export type LocationEnvironmentSheetOutputFormat = 'png' | 'jpeg' | 'webp';
export type LocationEnvironmentSheetFileRole =
  | 'composite'
  | 'view_front'
  | 'view_right'
  | 'view_back'
  | 'view_left';

export type CastCharacterSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type CastProfileModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image'
  | 'fal-ai/openai/gpt-image-2/edit'
  | 'fal-ai/nano-banana-2/edit'
  | 'fal-ai/xai/grok-imagine-image/edit';

export type LocationEnvironmentSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type SceneStoryboardSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type ShotVideoTakeInputModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type ShotVideoTakeInputGenerationPurpose =
  | typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_LAST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_REFERENCE_SHEET_GENERATION_PURPOSE
  | typeof SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE;

export type SceneStoryboardSheetFrame = '4:3';
export type SceneStoryboardShotFrame = LookbookImageFrame;
export type SceneStoryboardSheetDetail = LookbookImageDetail;
export type SceneStoryboardSheetOutputFormat = LookbookImageOutputFormat;

export interface LookbookImageGenerationTarget {
  kind: 'lookbook';
  id: string;
}

export interface CastMediaGenerationTarget {
  kind: 'castMember';
  id: string;
}

export interface LocationMediaGenerationTarget {
  kind: 'location';
  id: string;
}

export interface SceneMediaGenerationTarget {
  kind: 'scene';
  id: string;
}

export interface SceneShotMediaGenerationTarget {
  kind: 'sceneShotGroup';
  id: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  shotIds: string[];
}

export interface SceneShotMediaGenerationRequestTarget {
  kind: 'sceneShotGroup';
  id?: string;
  sceneId: string;
  shotListId: string;
  productionGroupId?: string;
  shotIds: string[];
}

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneShotMediaGenerationTarget;

export type MediaGenerationRequestTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget
  | SceneMediaGenerationTarget
  | SceneShotMediaGenerationRequestTarget;

export interface CastGenerationProjectContext {
  id?: string;
  name: string;
  title: string;
  aspectRatio: string | null;
  logline?: string | null;
  summary?: string | null;
  languages: ProjectLanguage[];
}

export interface CastGenerationScreenplayContext {
  title?: string;
  genrePrimary?: string;
  genreSecondary?: string[];
  tone?: string[];
  logline?: string;
  summary?: string;
  premiseOverview?: string;
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
}

export interface CastGenerationTimePeriodContext {
  historicalBasis: string[];
  locationTimePeriods: string[];
  sceneSignals: Array<{
    sceneId: string;
    title: string;
    setting?: SceneSetting;
  }>;
}

export interface CastGenerationAssetFileReference {
  assetId: string;
  assetFileId: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  mediaKind: string;
  mimeType: string | null;
}

export interface CastGenerationLookbookContext {
  lookbook: Lookbook;
  cardImage: LookbookImage | null;
  isActive: boolean;
}

export interface LocationGenerationProjectContext {
  id?: string;
  name: string;
  title: string;
  aspectRatio: string | null;
  logline?: string | null;
  summary?: string | null;
  languages: ProjectLanguage[];
}

export interface LocationGenerationScreenplayContext {
  title?: string;
  intendedAudience?: string;
  genrePrimary?: string;
  genreSecondary?: string[];
  tone?: string[];
  logline?: string;
  summary?: string;
  premiseOverview?: string;
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  researchSources?: string[];
  assumptionsMade?: string[];
}

export interface LocationGenerationUsageContext {
  scenes: Array<{
    sceneId: string;
    title: string;
    setting?: SceneSetting;
    storyFunction?: string[];
    excerpts: string[];
  }>;
}

export interface LocationGenerationLookbookContext {
  lookbook: Lookbook;
  cardImage: LookbookImage | null;
  isActive: true;
}

export interface LocationGenerationAssetFileReference {
  assetId: string;
  assetFileId: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  mediaKind: string;
  mimeType: string | null;
}

export interface CastCharacterSheetGenerationContext {
  purpose: typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  project: CastGenerationProjectContext;
  screenplay: CastGenerationScreenplayContext | null;
  castMember: CastMember;
  timePeriod: CastGenerationTimePeriodContext;
  activeLookbook: CastGenerationLookbookContext;
  selectedAssets: Asset[];
  characterSheetTakes: Asset[];
  profileTakes: Asset[];
  imageFiles: CastGenerationAssetFileReference[];
  defaults: {
    takeCount: 1;
    seed: null;
    imageFrame: 'project';
    resolvedAspectRatio: string | null;
    detail: 'standard';
    outputFormat: 'png';
  };
  resourceKeys: string[];
}

export interface CastProfileGenerationContext {
  purpose: typeof CAST_PROFILE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  project: CastGenerationProjectContext;
  screenplay: CastGenerationScreenplayContext | null;
  castMember: CastMember;
  timePeriod: CastGenerationTimePeriodContext;
  activeLookbook: CastGenerationLookbookContext | null;
  selectedAssets: Asset[];
  selectedCharacterSheets: Asset[];
  characterSheetTakes: Asset[];
  profileTakes: Asset[];
  imageFiles: CastGenerationAssetFileReference[];
  recommendedSourceAssetId: string | null;
  defaults: {
    takeCount: 1;
    seed: null;
    imageFrame: '1:1';
    resolvedAspectRatio: '1:1';
    detail: 'standard';
    outputFormat: 'png';
  };
  resourceKeys: string[];
}

export interface LocationEnvironmentSheetGenerationContext {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  project: LocationGenerationProjectContext;
  screenplay: LocationGenerationScreenplayContext | null;
  location: Location;
  usage: LocationGenerationUsageContext;
  activeLookbook: LocationGenerationLookbookContext;
  selectedAssets: Asset[];
  environmentSheetTakes: Asset[];
  referenceAssets: Asset[];
  imageFiles: LocationGenerationAssetFileReference[];
  defaults: {
    takeCount: 1;
    seed: null;
    sheetFrame: '4:3';
    viewFrame: '16:9';
    detail: 'standard';
    outputFormat: 'png';
  };
  azimuths: Array<{
    azimuthDegrees: 0 | 90 | 180 | 270;
    direction: 'front' | 'right' | 'back' | 'left';
    fileRole:
      | 'view_front'
      | 'view_right'
      | 'view_back'
      | 'view_left';
  }>;
  historicalGuardrailInputs: {
    timePeriod: string | null;
    historicalBasis: string[];
    dramatizedElements: string[];
    researchSources: string[];
    assumptionsMade: string[];
  };
  resourceKeys: string[];
}

export interface SceneStoryboardSheetGenerationContext {
  purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE;
  target: SceneMediaGenerationTarget;
  shotListId: string;
  project: SceneShotListContextReport['project'];
  screenplay: SceneShotListContextReport['screenplay'];
  act: SceneShotListContextReport['act'];
  sequence: SceneShotListContextReport['sequence'];
  scene: SceneShotListContextReport['scene'];
  cast: SceneShotListContextReport['cast'];
  locations: SceneShotListContextReport['locations'];
  activeLookbook: SceneShotListContextReport['activeLookbook'];
  shotList: SceneShotListDocument;
  shotListSummary: SceneShotListSummary;
  defaults: {
    takeCount: 1;
    seed: null;
    sheetFrame: '4:3';
    shotFrame: 'project';
    resolvedShotFrame: string;
    detail: 'standard';
    outputFormat: 'png';
    maxShotsPerSheet: 4;
  };
  resourceKeys: string[];
}

export interface ShotVideoTakeProjectContext {
  id?: string;
  name: string;
  title: string;
  aspectRatio: string | null;
}

export interface ShotVideoTakeSceneContext {
  id: string;
  title: string;
  setting: SceneSetting;
  storyFunction: string[];
}

export interface ShotVideoTakeShotListContext {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface ShotVideoTakeCastReference {
  id: string;
  handle: string;
  name: string;
  role?: string;
  description?: string;
}

export interface ShotVideoTakeLocationReference {
  id: string;
  handle: string;
  name: string;
  description?: string;
}

export interface ShotVideoTakeLookbookReference {
  id: string;
  name: string;
  thesis: string;
}

export interface ShotVideoTakeStoryboardImageReference {
  shotId: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
}

export interface ShotVideoTakeAvailableInput {
  inputId: string;
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image' | 'audio' | 'video';
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
  productionGroupId?: string;
  shotIds: string[];
  mediaGenerationRunId?: string;
  selected: boolean;
  createdAt: string;
}

export interface SceneShotVideoTake {
  takeId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId?: string;
  shotIds: string[];
  selected: boolean;
  createdAt: string;
}

export interface ShotVideoTakeDefaults {
  intentId: ShotVideoTakeIntentId;
  imageDependencyModelChoice: ShotVideoTakeInputModelChoice;
  parameterValues: ShotVideoTakeParameterValues;
}

export interface ShotVideoTakeGenerationContext {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  project: ShotVideoTakeProjectContext;
  scene: ShotVideoTakeSceneContext;
  shotList: ShotVideoTakeShotListContext;
  productionGroup: ShotVideoTakeProductionGroup;
  shots: SceneShot[];
  referencedCast: ShotVideoTakeCastReference[];
  referencedLocations: ShotVideoTakeLocationReference[];
  activeLookbook: ShotVideoTakeLookbookReference | null;
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
  availableInputs: ShotVideoTakeAvailableInput[];
  existingTakes: SceneShotVideoTake[];
  defaults: ShotVideoTakeDefaults;
  resourceKeys: string[];
}

export interface LookbookImageGenerationContext {
  purpose: typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE;
  target: LookbookImageGenerationTarget;
  project: {
    id?: string;
    name: string;
    title: string;
    aspectRatio: string | null;
  };
  lookbook: Lookbook;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
  existingImages: LookbookImage[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
  cardImage: LookbookImage | null;
  defaults: {
    takeCount: 1;
    seed: null;
    imageFrame: 'project';
    resolvedAspectRatio: string | null;
    detail: 'standard';
    outputFormat: 'png';
  };
  resourceKeys: string[];
}

export interface LookbookImageGenerationSpec {
  purpose: typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE;
  target: LookbookImageGenerationTarget;
  modelChoice: LookbookImageModelChoice;
  prompt: string;
  focusSections: LookbookSection[];
  takeCount?: number;
  seed?: number | null;
  imageFrame?: LookbookImageFrame;
  detail?: LookbookImageDetail;
  outputFormat?: LookbookImageOutputFormat;
  title?: string;
}

export interface CastCharacterSheetGenerationSpec {
  purpose: typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  modelChoice: CastCharacterSheetModelChoice;
  prompt: string;
  takeCount?: number;
  seed?: number | null;
  imageFrame?: CastImageFrame;
  detail?: CastImageDetail;
  outputFormat?: CastImageOutputFormat;
  title?: string;
}

export interface CastProfileGenerationSpec {
  purpose: typeof CAST_PROFILE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  modelChoice: CastProfileModelChoice;
  prompt: string;
  sourceAssetId?: string | null;
  takeCount?: number;
  seed?: number | null;
  imageFrame?: CastImageFrame;
  detail?: CastImageDetail;
  outputFormat?: CastImageOutputFormat;
  title?: string;
}

export interface LocationEnvironmentSheetGenerationSpec {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  modelChoice: LocationEnvironmentSheetModelChoice;
  prompt: string;
  takeCount?: 1;
  seed?: number | null;
  sheetFrame?: LocationEnvironmentSheetFrame;
  viewFrame?: LocationEnvironmentViewFrame;
  detail?: LocationEnvironmentSheetDetail;
  outputFormat?: LocationEnvironmentSheetOutputFormat;
  title?: string;
}

export interface SceneStoryboardSheetGenerationSpec {
  purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE;
  target: SceneMediaGenerationTarget;
  shotListId: string;
  shotIds: string[];
  modelChoice: SceneStoryboardSheetModelChoice;
  prompt: string;
  takeCount?: 1;
  seed?: number | null;
  sheetFrame?: SceneStoryboardSheetFrame;
  shotFrame?: SceneStoryboardShotFrame;
  detail?: SceneStoryboardSheetDetail;
  outputFormat?: SceneStoryboardSheetOutputFormat;
  title?: string;
}

export interface ShotVideoTakeInputGenerationSpec {
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  planId?: string;
  dependencyKind: ShotVideoTakeDependencyKind;
  outputInputKind: ShotVideoTakeInputKind;
  modelChoice: ShotVideoTakeInputModelChoice;
  prompt: string;
  parameterValues: ShotVideoTakeParameterValues;
  title?: string;
}

export interface ShotVideoTakeGenerationInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId: string;
  role: string;
  mediaKind: 'image' | 'audio' | 'video';
  projectRelativePath: ProjectRelativePath;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ShotVideoTakeGenerationSpec {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  planId?: string;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  prompt: string;
  negativePrompt?: string;
  parameterValues: ShotVideoTakeParameterValues;
  inputs: ShotVideoTakeGenerationInput[];
  title?: string;
}

export type MediaGenerationSpec =
  | LookbookImageGenerationSpec
  | CastCharacterSheetGenerationSpec
  | CastProfileGenerationSpec
  | LocationEnvironmentSheetGenerationSpec
  | SceneStoryboardSheetGenerationSpec
  | ShotVideoTakeInputGenerationSpec
  | ShotVideoTakeGenerationSpec;

export interface LookbookImageModelChoiceReport {
  modelChoice: LookbookImageModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  takeCount: {
    min: 1;
    max: number;
    default: 1;
  };
  supportedFrames: LookbookImageFrame[];
  supportedDetails: LookbookImageDetail[];
  supportedOutputFormats: LookbookImageOutputFormat[];
}

export interface CastImageModelChoiceReport {
  modelChoice: CastCharacterSheetModelChoice | CastProfileModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  requiresSourceAsset: boolean;
  takeCount: {
    min: 1;
    max: number;
    default: 1;
  };
  supportedFrames: CastImageFrame[];
  supportedDetails: CastImageDetail[];
  supportedOutputFormats: CastImageOutputFormat[];
}

export interface CastCharacterSheetModelListReport {
  purpose: typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  models: CastImageModelChoiceReport[];
}

export interface CastProfileModelListReport {
  purpose: typeof CAST_PROFILE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  models: CastImageModelChoiceReport[];
}

export interface LocationEnvironmentSheetModelChoiceReport {
  modelChoice: LocationEnvironmentSheetModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  takeCount: {
    min: 1;
    max: 1;
    default: 1;
  };
  supportedSheetFrames: LocationEnvironmentSheetFrame[];
  supportedViewFrames: LocationEnvironmentViewFrame[];
  supportedDetails: LocationEnvironmentSheetDetail[];
  supportedOutputFormats: LocationEnvironmentSheetOutputFormat[];
}

export interface SceneStoryboardSheetModelChoiceReport {
  modelChoice: SceneStoryboardSheetModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  takeCount: {
    min: 1;
    max: 1;
    default: 1;
  };
  supportedSheetFrames: SceneStoryboardSheetFrame[];
  supportedShotFrames: SceneStoryboardShotFrame[];
  supportedDetails: SceneStoryboardSheetDetail[];
  supportedOutputFormats: SceneStoryboardSheetOutputFormat[];
}

export interface SceneStoryboardSheetModelListReport {
  purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE;
  target: SceneMediaGenerationTarget;
  shotListId: string;
  models: SceneStoryboardSheetModelChoiceReport[];
}

export interface ShotVideoTakeDurationSupport {
  supported: boolean;
  values?: number[];
  minimum?: number;
  maximum?: number;
  default?: number;
}

export interface ShotVideoTakeModelInputRoleReport {
  kind: ShotVideoTakeInputKind;
  required: boolean;
  minCount: number;
  maxCount: number | null;
  mediaKind: 'image' | 'audio' | 'video';
}

export interface ShotVideoTakeParameterReport {
  name: string;
  label: string;
  required: boolean;
  defaultValue?: import('./scene-shot-list.js').ShotVideoTakeParameterValue;
  allowedValues?: import('./scene-shot-list.js').ShotVideoTakeParameterValue[];
  minimum?: number;
  maximum?: number;
}

export interface ShotVideoTakeEstimateInputReport {
  canEstimateBeforeDependenciesExist: boolean;
  requiresPreparedInputs: boolean;
}

export interface ShotVideoTakeModelChoiceReport {
  modelChoice: ShotVideoTakeModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportedIntents: ShotVideoTakeIntentId[];
  duration: ShotVideoTakeDurationSupport;
  inputRoles: ShotVideoTakeModelInputRoleReport[];
  parameters: ShotVideoTakeParameterReport[];
  estimateInputs: ShotVideoTakeEstimateInputReport;
}

export interface ShotVideoTakeModelListReport {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  intentId?: ShotVideoTakeIntentId;
  defaultModelChoice: ShotVideoTakeModelChoice;
  models: ShotVideoTakeModelChoiceReport[];
}

export interface ShotVideoTakeInputModelChoiceReport {
  modelChoice: ShotVideoTakeInputModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  mediaKind: 'image';
  defaultParameterValues: ShotVideoTakeParameterValues;
  parameters: ShotVideoTakeParameterReport[];
}

export interface ShotVideoTakeInputModelListReport {
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  defaultModelChoice: ShotVideoTakeInputModelChoice;
  models: ShotVideoTakeInputModelChoiceReport[];
}

export interface ShotVideoTakePreflightInput extends ShotVideoTakeGenerationInput {
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
}

export interface ShotVideoTakePreflightDependency {
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  purpose?: MediaGenerationPurpose;
  outputInputKind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  mediaKind: 'image' | 'audio' | 'video';
  reason: string;
}

export interface ShotVideoTakePreflightPrompt {
  purpose: ShotVideoTakeInputGenerationPurpose | typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  prompt: string;
  negativePrompt?: string;
  title?: string;
}

export type ShotVideoTakePreflightInputItemStatus =
  | 'ready'
  | 'available'
  | 'needed';

export interface ShotVideoTakePreflightInputCandidate {
  inputId: string;
  label: string;
}

export interface ShotVideoTakePreflightInputSlot {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}

export interface ShotVideoTakePreflightInputItem {
  key: string;
  title: string;
  caption: string;
  mediaKind: 'image' | 'audio' | 'video';
  status: ShotVideoTakePreflightInputItemStatus;
  assetId?: string;
  assetFileId?: string;
  projectRelativePath?: ProjectRelativePath;
  url?: string;
  planLineId?: string;
  dependencyNodeId?: string;
  purpose?: MediaGenerationPurpose | null;
  pricing?: MediaGenerationDependencyPricing;
  slot?: ShotVideoTakePreflightInputSlot;
  candidates?: ShotVideoTakePreflightInputCandidate[];
  selectedInputId?: string | null;
}

export interface ShotVideoTakePreflightFinalTake {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  canCreateSpec: boolean;
  title: string;
}

export interface ShotVideoTakePreflightReport {
  valid: boolean;
  issues: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  plan?: ShotVideoTakeGenerationPlan;
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  availableInputs: ShotVideoTakeAvailableInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  inputPlanItems: ShotVideoTakePreflightInputItem[];
  prompts: ShotVideoTakePreflightPrompt[];
  finalTake: ShotVideoTakePreflightFinalTake;
  agentBrief: string;
  estimate: GenerationEstimate | null;
}

export interface ShotVideoTakeProductionEstimateReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  estimate: GenerationEstimate | null;
  plan?: ShotVideoTakeGenerationPlan;
  issues: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type ShotVideoTakeReferenceChoiceState =
  | 'selected-ready'
  | 'selected-planned'
  | 'available'
  | 'not-selected'
  | 'unavailable';

export interface ShotVideoTakeReferenceImagePreview {
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  title: string;
  alt: string;
  url?: string;
}

export interface ShotVideoTakeReferenceCardPlan {
  state: ShotVideoTakeReferenceChoiceState;
  mediaKind: MediaKind;
  dependencyId?: string;
  dependencyNodeId?: string;
  planLineId?: string;
  purpose?: MediaGenerationPurpose | null;
  pricing: MediaGenerationDependencyPricing;
  previews: ShotVideoTakeReferenceImagePreview[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeCastReferenceChoice {
  castMemberId: string;
  name: string;
  selected: boolean;
  defaultSelected: boolean;
  characterSheet: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeLocationViewChoice {
  viewId: LocationAzimuthViewId;
  label: string;
  selected: boolean;
  preview: ShotVideoTakeReferenceImagePreview | null;
}

export interface ShotVideoTakeLocationReferenceChoice {
  locationId: string;
  name: string;
  selected: boolean;
  defaultSelected: boolean;
  environmentSheet: ShotVideoTakeReferenceCardPlan;
  viewChoices: ShotVideoTakeLocationViewChoice[];
}

export interface ShotVideoTakeLookbookReferenceChoice {
  lookbookImageId: string | null;
  lookbookId: string;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  image: ShotVideoTakeReferenceCardPlan;
}

export type ShotVideoTakeImageReferenceKind =
  | 'first-frame'
  | 'last-frame'
  | 'shot-reference-sheet'
  | 'custom-reference-image';

export interface ShotVideoTakeImageReferenceChoice {
  referenceKind: ShotVideoTakeImageReferenceKind;
  title: string;
  selected: boolean;
  image: ShotVideoTakeReferenceCardPlan;
}

export interface ShotVideoTakeProductionPlanReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  finalPrompt: ShotVideoTakePromptDraft | null;
  plan: ShotVideoTakeGenerationPlan;
  castReferences: ShotVideoTakeCastReferenceChoice[];
  locationReferences: ShotVideoTakeLocationReferenceChoice[];
  lookbookReferences: ShotVideoTakeLookbookReferenceChoice[];
  imageReferences: ShotVideoTakeImageReferenceChoice[];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type ShotVideoInputPolicyMode = 'reuse-selected' | 'regenerate' | 'auto';

export interface ShotVideoTakeInputPolicy {
  defaultMode: ShotVideoInputPolicyMode;
  slotModes?: Record<string, ShotVideoInputPolicyMode>;
}

export type MediaGenerationDependencyNodeKind =
  | 'existing-asset'
  | 'planned-generation'
  | 'external-input-required'
  | 'final-generation';

export type MediaGenerationDependencyNodeState = 'ready' | 'planned' | 'missing';

export type MediaGenerationDependencyPricing =
  | {
      state: 'priced';
      estimatedUsd: number;
    }
  | {
      state: 'unpriced';
      estimatedUsd: null;
      reason: string;
      overrideRequired: true;
    }
  | {
      state: 'not-applicable';
      estimatedUsd: null;
    };

export interface DraftMediaGenerationSpec {
  purpose: MediaGenerationPurpose;
  spec: MediaGenerationSpec;
}

export interface MediaGenerationDependencyNode {
  id: string;
  kind: MediaGenerationDependencyNodeKind;
  purpose: MediaGenerationPurpose | null;
  mediaKind: MediaKind;
  label: string;
  state: MediaGenerationDependencyNodeState;
  pricing: MediaGenerationDependencyPricing;
  dependencyId?: string;
  dependencyKind?: MediaGenerationDependencyKind;
  dependencyTarget?: MediaGenerationTarget;
  assetId?: string;
  assetFileId?: string;
  draftGenerationSpec?: DraftMediaGenerationSpec;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface MediaGenerationDependencyEdge {
  fromNodeId: string;
  toNodeId: string;
  dependencyId: string;
}

export interface MediaGenerationDependencyEstimate {
  state: 'complete' | 'partial' | 'unavailable';
  estimatedTotalUsd: number | null;
  pricedNodeCount: number;
  unpricedNodeCount: number;
  missingNodeCount: number;
  requiresPriceOverride: boolean;
}

export interface MediaGenerationDependencyExecution {
  topologicalNodeIds: string[];
  levels: string[][];
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface MediaGenerationDependencyMap {
  rootPurpose: MediaGenerationPurpose;
  nodes: MediaGenerationDependencyNode[];
  edges: MediaGenerationDependencyEdge[];
  estimate: MediaGenerationDependencyEstimate;
  execution: MediaGenerationDependencyExecution;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export type MediaGenerationPlanLineKind =
  | 'reused-asset'
  | 'dependency-generation'
  | 'required-attachment'
  | 'final-video-generation';

export interface MediaGenerationPlanLine {
  id: string;
  nodeId: string;
  kind: MediaGenerationPlanLineKind;
  label: string;
  purpose: MediaGenerationPurpose | null;
  mediaKind: MediaKind;
  dependencyId?: string;
  dependencyKind?: MediaGenerationDependencyKind;
  depth: number;
  state: MediaGenerationDependencyNodeState;
  pricing: MediaGenerationDependencyPricing;
  sourceAssetId?: string;
  draftGenerationSpec?: DraftMediaGenerationSpec;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface ShotVideoTakeGenerationPlanRequest {
  projectId: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  intent: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  routeSettings: ShotVideoTakeParameterValues;
  inputPolicy: ShotVideoTakeInputPolicy;
}

export interface ShotVideoTakePlanModel {
  choice: ShotVideoTakeModelChoice;
  label: string;
  version: string;
  provider: 'fal-ai';
}

export interface ShotVideoTakePlanRoute {
  intent: ShotVideoTakeIntentId;
  providerModel: string;
  mode: 'text-to-video' | 'image-to-video';
  inputRoles: ShotVideoTakeModelInputRoleReport[];
  parameters: ShotVideoTakeParameterReport[];
}

export interface ShotVideoTakeGenerationPlanEstimate {
  state: 'complete' | 'partial' | 'unavailable';
  estimatedTotalUsd: number | null;
  pricedLineCount: number;
  unpricedLineCount: number;
  missingLineCount: number;
  requiresPriceOverride: boolean;
}

export interface ShotVideoTakeGenerationPlan {
  planId: string;
  request: ShotVideoTakeGenerationPlanRequest;
  model: ShotVideoTakePlanModel;
  route: ShotVideoTakePlanRoute;
  dependencyMap: MediaGenerationDependencyMap;
  lines: MediaGenerationPlanLine[];
  estimate: ShotVideoTakeGenerationPlanEstimate;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  finalEstimate: GenerationEstimate | null;
}

export interface LocationEnvironmentSheetModelListReport {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  models: LocationEnvironmentSheetModelChoiceReport[];
}

export interface LookbookImageModelListReport {
  purpose: typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE;
  target: LookbookImageGenerationTarget;
  models: LookbookImageModelChoiceReport[];
}

export interface MediaGenerationSpecRecord {
  id: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  modelChoice:
    | LookbookImageModelChoice
    | CastCharacterSheetModelChoice
    | CastProfileModelChoice
    | LocationEnvironmentSheetModelChoice
    | SceneStoryboardSheetModelChoice
    | ShotVideoTakeInputModelChoice
    | ShotVideoTakeModelChoice;
  title: string;
  spec: MediaGenerationSpec;
  createdAt: string;
  updatedAt: string;
}

export interface MediaGenerationRun {
  id: string;
  specId: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  modelChoice:
    | LookbookImageModelChoice
    | CastCharacterSheetModelChoice
    | CastProfileModelChoice
    | LocationEnvironmentSheetModelChoice
    | SceneStoryboardSheetModelChoice
    | ShotVideoTakeInputModelChoice
    | ShotVideoTakeModelChoice;
  provider: 'fal-ai';
  model: string;
  specSnapshot: MediaGenerationSpec;
  providerPayload: Record<string, unknown>;
  estimateSnapshot: unknown;
  approvalToken?: string;
  simulated: boolean;
  status: 'simulated' | 'completed' | 'failed';
  outputs: unknown;
  diagnostics: unknown;
  startedAt: string;
  completedAt: string | null;
}

export interface MediaGenerationEstimateReport {
  spec: MediaGenerationSpecRecord;
  providerPayload: Record<string, unknown>;
  estimate: GenerationEstimate;
}

export interface PreparedMediaGeneration {
  spec: MediaGenerationSpecRecord;
  providerPayload: Record<string, unknown>;
  generation: {
    policy: {
      provider: 'fal-ai';
      model: string;
      mediaKind: 'image' | 'video';
      mode: 'text-to-image' | 'image-edit' | 'text-to-video' | 'image-to-video';
      outputCount: number;
    };
    request: {
      prompt: string;
      inputFiles?: Array<{
        field: string;
        projectRelativePath: string;
        mediaKind: 'image' | 'audio' | 'video';
        asArray?: boolean;
        required?: boolean;
      }>;
      pricingInputCounts?: Partial<Record<'image' | 'audio' | 'video', number>>;
      parameters: Record<string, unknown>;
      outputNames: string[];
    };
  };
}

export interface MediaGenerationRunReport {
  run: MediaGenerationRun;
}

export interface LookbookImageMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE;
  target: LookbookImageGenerationTarget;
  imported: LookbookImage;
  receipt?: unknown;
  resourceKeys: string[];
}

export interface CastMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose:
    | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
    | typeof CAST_PROFILE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  imported: Asset;
  receipt?: unknown;
  resourceKeys: string[];
}

export interface LocationEnvironmentSheetMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  imported: Asset;
  files: Array<{
    role: LocationEnvironmentSheetFileRole;
    projectRelativePath: ProjectRelativePath;
  }>;
  resourceKeys: string[];
}

export interface ShotVideoTakeInputMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  imported: Asset;
  input: ShotVideoTakeAvailableInput;
  receipt?: unknown;
  resourceKeys: string[];
}

export interface ShotVideoTakeMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  imported: Asset;
  take: SceneShotVideoTake;
  receipt?: unknown;
  resourceKeys: string[];
}
