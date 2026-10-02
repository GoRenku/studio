import type {
  GenerationWorkflowPolicy,
  ProjectSettingsDocument,
} from '../../client/project-settings.js';
import type { MediaGenerationKind } from '../../client/media-generation-review.js';
import type { RenkuConfig } from '../config/document.js';

export function resolveGenerationWorkflowPolicy(input: {
  settings: ProjectSettingsDocument;
  outputMediaKind: MediaGenerationKind;
  config: Pick<RenkuConfig, 'codexGenerationReview' | 'codexGenerationReviewDisplayMode'>;
}): GenerationWorkflowPolicy {
  const settings = input.settings.generation[input.outputMediaKind];
  return {
    codexGenerationReview: input.config.codexGenerationReview,
    codexGenerationReviewDisplayMode: input.config.codexGenerationReviewDisplayMode,
    displayPreview: input.settings.generation.displayPreview,
    enableProviderPromptExpansion:
      input.settings.generation.enableProviderPromptExpansion,
    provider: settings.provider,
    askBeforeGenerating: settings.askBeforeGenerating,
    concurrencyLimit: effectiveConcurrencyLimit(settings),
  };
}

function effectiveConcurrencyLimit(lane: {
  runGenerationsConcurrently: boolean;
  maxConcurrentGenerations: number;
}): number {
  return lane.runGenerationsConcurrently ? lane.maxConcurrentGenerations : 1;
}
