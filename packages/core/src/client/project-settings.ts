import type { CastingSettings } from './casting/model.js';
import type { GenerationLane } from './generation-lanes.js';

export const STUDIO_PROJECT_SETTINGS_RESOURCE_KEY = 'project-settings' as const;

export interface ProjectSettingsDocument {
  version: 8;
  screenplayImport: {
    createContinuitySubjects: boolean;
    generateContinuityImages: boolean;
    runScreenplayAnalysis: boolean;
    generateSceneBeats: boolean;
    generateBeatStoryboardImages: boolean;
  };
  generation: ProjectGenerationSettings;
  /** Models and counts that pre-fill the Casting Round panel. */
  casting: CastingSettings;
}

export interface ProjectGenerationSettings {
  enableProviderPromptExpansion: boolean;
  image: GenerationLaneSettings;
  imageEdit: GenerationLaneSettings;
  video: GenerationLaneSettings;
  audio: GenerationLaneSettings;
}

export interface GenerationLaneSettings {
  /** Opaque kebab-case provider id. */
  provider: string;
  /** Null means the Skill's recommendation for the provider. */
  model: GenerationLaneModel | null;
  chooseRouteBeforeGenerating: boolean;
  askBeforeGenerating: boolean;
  runGenerationsConcurrently: boolean;
  maxConcurrentGenerations: number;
}

export interface GenerationLaneModel {
  /** Skill model guide key, such as a model family. */
  key: string;
  /** Display name from the Default Model List. */
  name: string;
}

export interface UpdateGenerationLaneSettingsChange {
  lane: GenerationLane;
  provider?: string;
  model?: GenerationLaneModel | null;
  chooseRouteBeforeGenerating?: boolean;
  askBeforeGenerating?: boolean;
}

export interface ProjectSettingsResource {
  project: {
    name: string;
    id: string;
  };
  settings: ProjectSettingsDocument;
}

export interface ProjectSettingsMutationReport {
  resource: ProjectSettingsResource;
  resourceKeys: string[];
}

export type CodexGenerationReviewDisplayMode = 'inline' | 'fullscreen';

export interface GenerationWorkflowPolicy {
  codexPluginInstalled: boolean;
  codexGenerationReviewDisplayMode: CodexGenerationReviewDisplayMode;
  enableProviderPromptExpansion: boolean;
  lane: GenerationLane;
  provider: string;
  model: GenerationLaneModel | null;
  chooseRouteBeforeGenerating: boolean;
  askBeforeGenerating: boolean;
  concurrencyLimit: number;
}
