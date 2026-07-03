import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import type {
  DraftMediaGenerationSpec,
  MediaGenerationDependencyPricing,
} from '../../../client/index.js';
import {
  mediaGenerationCostEstimateToPricing,
} from './cost-projection.js';
import {
  estimateDraftMediaGenerationSpec,
} from './spec-estimates.js';

export async function estimateMissingShotInputDependency(input: {
  projectName?: string;
  homeDir?: string;
  draftGenerationSpec: DraftMediaGenerationSpec;
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  estimate: GenerationCostEstimate | null;
}> {
  const estimateReport = await estimateDraftMediaGenerationSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.draftGenerationSpec.spec,
  });
  const estimate = estimateReport.estimate;
  return {
    pricing: mediaGenerationCostEstimateToPricing(estimate),
    estimate,
  };
}

export function estimateOnlyShotInputPrompt(label: string): string {
  return [
    `Estimate placeholder for ${label}.`,
    'This draft is used only for pricing; an authored prompt is required before generation.',
  ].join(' ');
}
