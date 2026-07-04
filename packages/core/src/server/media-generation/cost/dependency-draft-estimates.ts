import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  DraftMediaGenerationSpec,
  MediaGenerationDependencyPricing,
} from '../../../client/index.js';
import { mediaGenerationCostEstimateToPricing } from './cost-projection.js';

export interface DependencyDraftEstimateResult {
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
}

export async function estimateMediaGenerationDependencyDraft(input: {
  projectName?: string;
  homeDir?: string;
  draftGenerationSpec: DraftMediaGenerationSpec;
  dependencyId: string;
  label: string;
}): Promise<DependencyDraftEstimateResult> {
  const { estimateDraftMediaGenerationSpec } = await import('./spec-estimates.js');
  const estimateReport = await estimateDraftMediaGenerationSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.draftGenerationSpec.spec,
  });
  const pricing = mediaGenerationCostEstimateToPricing(estimateReport.estimate);
  if (pricing.state === 'priced') {
    return { pricing, diagnostics: [] };
  }
  if (pricing.state === 'missing-pricing-input') {
    return {
      pricing,
      diagnostics: [
        createDiagnosticError(
          'CORE_MEDIA_COST_INPUT_MISSING',
          `Dependency generation is missing pricing inputs: ${input.label}.`,
          { path: ['dependencyInventory', 'dependencies', input.dependencyId] },
          `Complete pricing input values: ${pricing.missingInputs.join(', ')}.`
        ),
      ],
    };
  }
  return {
    pricing,
    diagnostics: [
      createDiagnosticError(
        'CORE_MEDIA_DEPENDENCY_UNPRICED_LINE',
        `Dependency generation is not priced: ${input.label}.`,
        { path: ['dependencyInventory', 'dependencies', input.dependencyId] },
        pricing.reason
      ),
    ],
  };
}
