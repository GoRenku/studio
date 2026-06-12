import type { Asset } from './assets.js';
import type { Location } from './locations.js';
import type { LocationDesignSummary } from './department-design.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project.js';
import type { SceneSetting } from './screenplay.js';
import type { Lookbook, LookbookImage } from './visual-language.js';
import type { LocationMediaGenerationTarget } from './media-generation-target.js';
import { LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE } from './media-generation-purpose.js';

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

export type LocationEnvironmentSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

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
