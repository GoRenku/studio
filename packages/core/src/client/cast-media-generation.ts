import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { CastVoice } from './cast-voices.js';
import type { CastDesignSummary } from './department-design.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { Lookbook, LookbookImage } from './visual-language.js';
import type { CastMediaGenerationTarget } from './media-generation-target.js';
import type { LookbookImageDetail, LookbookImageFrame, LookbookImageOutputFormat } from './lookbook-media-generation.js';
import { CAST_CHARACTER_SHEET_GENERATION_PURPOSE, CAST_PROFILE_GENERATION_PURPOSE, CAST_VOICE_SAMPLE_GENERATION_PURPOSE } from './media-generation-purpose.js';

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

export type CastVoiceSampleModelChoice =
  | 'elevenlabs/eleven_v3'
  | 'elevenlabs/eleven_multilingual_v2'
  | 'elevenlabs/eleven_turbo_v2_5';

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
  activeCastDesign: CastDesignSummary | null;
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
  activeCastDesign: CastDesignSummary | null;
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

export interface CastVoiceSampleGenerationContext {
  purpose: typeof CAST_VOICE_SAMPLE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  project: CastGenerationProjectContext;
  screenplay: CastGenerationScreenplayContext | null;
  castMember: CastMember;
  activeCastDesign: CastDesignSummary | null;
  voices: CastVoice[];
  voiceSampleAssets: Asset[];
  defaults: {
    modelChoice: 'elevenlabs/eleven_v3';
    outputFormat: 'mp3_44100_128';
    languageCode: string | null;
  };
  resourceKeys: string[];
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

export interface CastVoiceSampleGenerationSpec {
  purpose: typeof CAST_VOICE_SAMPLE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  modelChoice: CastVoiceSampleModelChoice;
  voiceId: string;
  text: string;
  referenceName: string;
  referencePurpose: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  };
  outputFormat?: string;
  languageCode?: string | null;
  title?: string;
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

export interface CastVoiceSampleModelChoiceReport {
  modelChoice: CastVoiceSampleModelChoice;
  label: string;
  available: true;
  provider: 'elevenlabs';
  model: 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5';
  mediaKind: 'audio';
  mode: 'text-to-speech';
}

export interface CastVoiceSampleModelListReport {
  purpose: typeof CAST_VOICE_SAMPLE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  models: CastVoiceSampleModelChoiceReport[];
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
