export const STUDIO_PROJECT_SETTINGS_RESOURCE_KEY = 'project-settings' as const;

export interface ProjectSettingsDocument {
  version: 3;
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
  image: GenerationMediaSettings<'codex' | 'fal-ai'>;
  video: GenerationMediaSettings<'fal-ai'>;
  audio: GenerationMediaSettings<'elevenlabs'>;
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
  provider: 'codex' | 'fal-ai' | 'elevenlabs';
  askBeforeGenerating: boolean;
  concurrencyLimit: number;
}
