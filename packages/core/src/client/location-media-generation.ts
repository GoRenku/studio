import type { Asset } from './assets.js';
import type { Location } from './locations.js';
import type { LocationDesignSummary } from './department-design.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { Lookbook, LookbookImage } from './visual-language.js';
import type { LocationMediaGenerationTarget } from './media-generation-target.js';
import {
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
} from './media-generation-purpose.js';

export type LocationEnvironmentSheetFrame = '4:3';

export type LocationEnvironmentSheetDetail = 'draft' | 'standard' | 'high';

export type LocationEnvironmentSheetOutputFormat = 'png' | 'jpeg' | 'webp';

export type LocationHeroFrame = '16:9';

export type LocationHeroDetail = 'draft' | 'standard' | 'high';

export type LocationHeroOutputFormat = 'png' | 'jpeg' | 'webp';

export type LocationEnvironmentSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type LocationHeroModelChoice =
  | 'fal-ai/openai/gpt-image-2/edit'
  | 'fal-ai/nano-banana-2/edit'
  | 'fal-ai/xai/grok-imagine-image/edit';

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

export interface LocationEnvironmentSheetGenerationContext {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  project: LocationGenerationProjectContext;
  screenplay: LocationGenerationScreenplayContext | null;
  location: Location;
  activeLocationDesign: LocationDesignSummary | null;
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
    detail: 'standard';
    outputFormat: 'png';
  };
  historicalGuardrailInputs: {
    timePeriod: string | null;
    historicalBasis: string[];
    dramatizedElements: string[];
    researchSources: string[];
    assumptionsMade: string[];
  };
  resourceKeys: string[];
}

export interface LocationEnvironmentSheetGenerationSpec {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  modelChoice: LocationEnvironmentSheetModelChoice;
  prompt: string;
  takeCount?: 1;
  seed?: number | null;
  sheetFrame?: LocationEnvironmentSheetFrame;
  detail?: LocationEnvironmentSheetDetail;
  outputFormat?: LocationEnvironmentSheetOutputFormat;
  title?: string;
  description: string;
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
  supportedDetails: LocationEnvironmentSheetDetail[];
  supportedOutputFormats: LocationEnvironmentSheetOutputFormat[];
}

export interface LocationEnvironmentSheetModelListReport {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  models: LocationEnvironmentSheetModelChoiceReport[];
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
    role: 'primary';
    projectRelativePath: ProjectRelativePath;
  }>;
  resourceKeys: string[];
}

export interface LocationHeroGenerationContext {
  purpose: typeof LOCATION_HERO_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  project: LocationGenerationProjectContext;
  screenplay: LocationGenerationScreenplayContext | null;
  location: Location;
  activeLocationDesign: LocationDesignSummary | null;
  activeLookbook: LocationGenerationLookbookContext;
  environmentSheetTakes: Asset[];
  sourceLocationSheetAsset: Asset | null;
  imageFiles: LocationGenerationAssetFileReference[];
  defaults: {
    takeCount: 1;
    seed: null;
    heroFrame: '16:9';
    detail: 'standard';
    outputFormat: 'png';
  };
  resourceKeys: string[];
}

export interface LocationHeroGenerationSpec {
  purpose: typeof LOCATION_HERO_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  sourceLocationSheetAssetId: string;
  modelChoice: LocationHeroModelChoice;
  prompt: string;
  takeCount?: 1;
  seed?: number | null;
  heroFrame?: LocationHeroFrame;
  detail?: LocationHeroDetail;
  outputFormat?: LocationHeroOutputFormat;
  title?: string;
  description: string;
}

export interface LocationHeroModelChoiceReport {
  modelChoice: LocationHeroModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  takeCount: {
    min: 1;
    max: 1;
    default: 1;
  };
  supportedHeroFrames: LocationHeroFrame[];
  supportedDetails: LocationHeroDetail[];
  supportedOutputFormats: LocationHeroOutputFormat[];
}

export interface LocationHeroModelListReport {
  purpose: typeof LOCATION_HERO_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  models: LocationHeroModelChoiceReport[];
}

export interface LocationHeroMediaImportReport {
  valid: true;
  warnings: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof LOCATION_HERO_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  imported: Asset;
  sourceLocationSheetAssetId: string;
  files: Array<{
    role: 'primary';
    projectRelativePath: ProjectRelativePath;
  }>;
  resourceKeys: string[];
}
