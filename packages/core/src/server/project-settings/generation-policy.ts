import type {
  GenerationWorkflowPolicy,
  ProjectSettingsDocument,
} from '../../client/project-settings.js';
import type { MediaPurpose } from '../../client/media-attachments.js';
import { MEDIA_PURPOSE_GENERATION_LANES } from '../../client/generation-lanes.js';
import type { RenkuConfig } from '../config/document.js';

export function resolveGenerationWorkflowPolicy(input: {
  settings: ProjectSettingsDocument;
  purpose: MediaPurpose;
  codexPluginInstalled: boolean;
  config: Pick<RenkuConfig, 'codexGenerationReviewDisplayMode'>;
}): GenerationWorkflowPolicy {
  const lane = MEDIA_PURPOSE_GENERATION_LANES[input.purpose];
  const settings = input.settings.generation[lane];
  return {
    codexPluginInstalled: input.codexPluginInstalled,
    codexGenerationReviewDisplayMode: input.config.codexGenerationReviewDisplayMode,
    enableProviderPromptExpansion:
      input.settings.generation.enableProviderPromptExpansion,
    lane,
    provider: settings.provider,
    model: settings.model,
    chooseRouteBeforeGenerating: settings.chooseRouteBeforeGenerating,
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
