import type {
  GenerationWorkflowPolicy,
  ProjectSettingsDocument,
} from '../../client/project-settings.js';
import type { GenerationOutputMediaKind } from '../../client/generation.js';

export function resolveGenerationWorkflowPolicy(input: {
  settings: ProjectSettingsDocument;
  outputMediaKind: GenerationOutputMediaKind;
}): GenerationWorkflowPolicy {
  const codexApplicable = input.outputMediaKind === 'image';
  return {
    displayPreview: input.settings.generation.displayPreview,
    preferredExecutionPath:
      codexApplicable && input.settings.generation.preferCodexImageGeneration
        ? 'codex-built-in'
        : 'renku-managed',
    renkuManaged: {
      executionKind: 'renku-managed',
      requirePerRunConfirmation:
        input.settings.generation.renkuManaged.requirePerRunConfirmation,
      concurrencyLimit: effectiveConcurrencyLimit(
        input.settings.generation.renkuManaged
      ),
    },
    codexBuiltIn: {
      applicable: codexApplicable,
      executionKind: 'agent-external',
      capability: 'codex.gpt-image-2',
      availableInRenku: false,
      requiresHarnessTool: true,
      requirePerRunConfirmation:
        input.settings.generation.codexBuiltIn.requirePerRunConfirmation,
      concurrencyLimit: effectiveConcurrencyLimit(
        input.settings.generation.codexBuiltIn
      ),
    },
  };
}

function effectiveConcurrencyLimit(lane: {
  allowConcurrentGenerations: boolean;
  maxConcurrentGenerations: number;
}): number {
  return lane.allowConcurrentGenerations ? lane.maxConcurrentGenerations : 1;
}
