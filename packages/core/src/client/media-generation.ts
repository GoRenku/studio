import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { Lookbook, LookbookImage, LookbookSection } from './visual-language.js';
import type { InspirationFolderWithResolvedPath } from './visual-language.js';

export const LOOKBOOK_IMAGE_GENERATION_PURPOSE = 'lookbook.image' as const;
export const CAST_CHARACTER_SHEET_GENERATION_PURPOSE =
  'cast.character-sheet' as const;
export const CAST_PROFILE_GENERATION_PURPOSE = 'cast.profile' as const;

export type MediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export type MediaGenerationPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE;

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

export interface LookbookImageGenerationTarget {
  kind: 'lookbook';
  id: string;
}

export interface CastMediaGenerationTarget {
  kind: 'castMember';
  id: string;
}

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget;

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

export type MediaGenerationSpec =
  | LookbookImageGenerationSpec
  | CastCharacterSheetGenerationSpec
  | CastProfileGenerationSpec;

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
    | CastProfileModelChoice;
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
    | CastProfileModelChoice;
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
  estimate: unknown;
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
