import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  DraftMediaGenerationSpec,
  MediaGenerationDependencyPricing,
} from '../../client/index.js';

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
  try {
    const { estimateDraftMediaGenerationSpec } = await import(
      './shared-generation-service.js'
    );
    const estimateReport = await estimateDraftMediaGenerationSpec({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: input.draftGenerationSpec.spec,
    });
    const estimate = estimateReport.estimate;
    if (estimate.estimatedCostUsd === null) {
      return {
        pricing: {
          state: 'unpriced',
          estimatedUsd: null,
          reason:
            estimate.warnings.join(' ') ||
            'No pricing is configured for this dependency route.',
          overrideRequired: true,
        },
        diagnostics: [
          createDiagnosticError(
            'CORE_MEDIA_DEPENDENCY_UNPRICED_LINE',
            `Dependency generation is not priced: ${input.label}.`,
            { path: ['dependencyInventory', 'dependencies', input.dependencyId] },
            estimate.warnings.join(' ') ||
              'Add pricing metadata for this supported dependency route or approve the unpriced generation.'
          ),
        ],
      };
    }
    return {
      pricing: { state: 'priced', estimatedUsd: estimate.estimatedCostUsd },
      diagnostics: [],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Dependency estimate failed.';
    return {
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: message,
        overrideRequired: true,
      },
      diagnostics: [
        createDiagnosticError(
          'CORE_MEDIA_DEPENDENCY_ESTIMATE_FAILED',
          message,
          { path: ['dependencyInventory', 'dependencies', input.dependencyId] },
          'Review the dependency draft spec and provider pricing support.'
        ),
      ],
    };
  }
}
