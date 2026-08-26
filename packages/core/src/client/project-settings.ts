export const STUDIO_PROJECT_SETTINGS_RESOURCE_KEY = 'project-settings' as const;

export interface ProjectSettingsDocument {
  version: 4;
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
  image: GenerationMediaSettings<'codex' | 'fal-ai' | 'pika'>;
  video: GenerationMediaSettings<'fal-ai' | 'pika'>;
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
  provider: 'codex' | 'fal-ai' | 'pika' | 'elevenlabs';
  askBeforeGenerating: boolean;
  concurrencyLimit: number;
}
