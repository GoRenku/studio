export type ImageGenerationExecutionPath =
  | 'codexBuiltInWhenAvailable'
  | 'renkuManaged'
  | 'ask';

export interface AgentMediaImageGenerationReport {
  defaultExecutionPath: ImageGenerationExecutionPath;
  appliesToPurpose: boolean;
  renkuManagedAvailable: boolean;
  externalBuiltInGeneration: {
    preferred: 'codex.gpt-image-2' | null;
    availableInRenku: false;
    requiresHarnessTool: true;
  };
}

export interface AgentMediaReport {
  imageGeneration: AgentMediaImageGenerationReport;
}
