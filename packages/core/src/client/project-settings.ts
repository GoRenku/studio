export const STUDIO_PROJECT_SETTINGS_RESOURCE_KEY = 'project-settings' as const;

export interface ProjectSettingsDocument {
  version: 1;
  screenplayImport: {
    createContinuitySubjects: boolean;
    generateContinuityImages: boolean;
    runScreenplayAnalysis: boolean;
    generateSceneBeatSheets: boolean;
    generateBeatStoryboardImages: boolean;
  };
  generation: {
    preferCodexImageGeneration: boolean;
    displayPreview: boolean;
    renkuManaged: {
      requirePerRunConfirmation: boolean;
      allowConcurrentGenerations: boolean;
      maxConcurrentGenerations: number;
    };
    codexBuiltIn: {
      requirePerRunConfirmation: boolean;
      allowConcurrentGenerations: boolean;
      maxConcurrentGenerations: number;
    };
  };
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
  preferredExecutionPath: 'codex-built-in' | 'renku-managed';
  renkuManaged: {
    executionKind: 'renku-managed';
    requirePerRunConfirmation: boolean;
    concurrencyLimit: number;
  };
  codexBuiltIn: {
    applicable: boolean;
    executionKind: 'agent-external';
    capability: 'codex.gpt-image-2';
    availableInRenku: false;
    requiresHarnessTool: true;
    requirePerRunConfirmation: boolean;
    concurrencyLimit: number;
  };
}
