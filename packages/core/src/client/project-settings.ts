export const STUDIO_PROJECT_SETTINGS_RESOURCE_KEY = 'project-settings' as const;

export interface ProjectSettingsDocument {
  version: 6;
  screenplayImport: {
    createContinuitySubjects: boolean;
    generateContinuityImages: boolean;
    runScreenplayAnalysis: boolean;
    generateSceneBeats: boolean;
    generateBeatStoryboardImages: boolean;
  };
  generation: ProjectGenerationSettings;
}

export interface ProjectGenerationSettings {
  displayPreview: boolean;
  enableProviderPromptExpansion: boolean;
  image: GenerationMediaSettings<string>;
  video: GenerationMediaSettings<string>;
  audio: GenerationMediaSettings<string>;
}

export interface GenerationMediaSettings<Provider extends string> {
  provider: Provider;
  askBeforeGenerating: boolean;
  runGenerationsConcurrently: boolean;
  maxConcurrentGenerations: number;
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

export interface GenerationWorkflowPolicy {
  displayPreview: boolean;
  enableProviderPromptExpansion: boolean;
  provider: string;
  askBeforeGenerating: boolean;
  concurrencyLimit: number;
}
