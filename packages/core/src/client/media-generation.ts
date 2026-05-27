import type { GenerationEstimate } from '@gorenku/studio-engines';
import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { Location } from './locations.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { Lookbook, LookbookImage, LookbookSection } from './visual-language.js';
import type { InspirationFolderWithResolvedPath } from './visual-language.js';

export const LOOKBOOK_IMAGE_GENERATION_PURPOSE = 'lookbook.image' as const;
export const CAST_CHARACTER_SHEET_GENERATION_PURPOSE =
  'cast.character-sheet' as const;
export const CAST_PROFILE_GENERATION_PURPOSE = 'cast.profile' as const;
export const LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE =
  'location.environment-sheet' as const;

export type MediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export type MediaGenerationPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE
  | typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;

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

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget;

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

export type MediaGenerationSpec =
  | LookbookImageGenerationSpec
  | CastCharacterSheetGenerationSpec
  | CastProfileGenerationSpec
  | LocationEnvironmentSheetGenerationSpec;

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
    | LocationEnvironmentSheetModelChoice;
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
    | LocationEnvironmentSheetModelChoice;
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
      mediaKind: 'image';
      mode: 'text-to-image' | 'image-edit';
      outputCount: number;
    };
    request: {
      prompt: string;
      inputFiles?: Array<{
        field: string;
        projectRelativePath: string;
        mediaKind: 'image';
        asArray?: boolean;
        required?: boolean;
      }>;
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
