import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  DraftMediaGenerationSpec,
  MediaGenerationDependencyKind,
  MediaGenerationDependencyMaterializationState,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencyPricing,
  MediaGenerationPurpose,
  MediaGenerationSpec,
  MediaGenerationTarget,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-registry.js';

export interface MediaGenerationDependencyDraftSpecInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  request: MediaGenerationDependencyRequest;
  dependencyKind: MediaGenerationDependencyKind;
  dependencyTarget: MediaGenerationTarget;
  label: string;
  reason: string;
}

export interface MediaGenerationDependencyDraftSpec {
  purpose: MediaGenerationPurpose;
  spec: MediaGenerationSpec;
  materializationState?: Extract<
    MediaGenerationDependencyMaterializationState,
    'generatable' | 'needs-authored-draft'
  >;
  materializationReason?: string;
}

export async function buildMediaGenerationDependencyDraftSpec(input: {
  purpose: MediaGenerationPurpose;
  draftInput: MediaGenerationDependencyDraftSpecInput;
}): Promise<MediaGenerationDependencyDraftSpec> {
  const definition = requireMediaGenerationPurposeDefinition(input.purpose);
  if (!definition.buildDependencyDraftSpec) {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_MISSING_DRAFT_BUILDER',
      `Media generation purpose has no dependency draft builder: ${input.purpose}.`,
      {
        suggestion:
          'Add buildDependencyDraftSpec to the purpose that owns this generated dependency.',
      }
    );
  }
  const draft = await definition.buildDependencyDraftSpec(input.draftInput);
  return {
    purpose: draft.purpose,
    spec: draft.spec,
    materializationState: draft.materializationState ?? 'generatable',
    ...(draft.materializationReason
      ? { materializationReason: draft.materializationReason }
      : {}),
  };
}

export async function estimateDraftDependency(
  input: {
    projectName?: string;
    homeDir?: string;
    draftGenerationSpec: DraftMediaGenerationSpec | MediaGenerationDependencyDraftSpec;
  },
  diagnostics: DiagnosticIssue[]
): Promise<MediaGenerationDependencyPricing> {
  try {
    const { estimateDraftMediaGenerationSpec } = await import('./shared-generation-service.js');
    const estimateReport = await estimateDraftMediaGenerationSpec({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: input.draftGenerationSpec.spec,
    });
    const estimate = estimateReport.estimate;
    if (estimate.estimatedCostUsd === null) {
      return {
        state: 'unpriced',
        estimatedUsd: null,
        reason: estimate.warnings.join(' ') || 'No pricing is configured for this dependency route.',
        overrideRequired: true,
      };
    }
    return { state: 'priced', estimatedUsd: estimate.estimatedCostUsd };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dependency estimate failed.';
    diagnostics.push(
      createDiagnosticError(
        'CORE_MEDIA_DEPENDENCY_ESTIMATE_FAILED',
        message,
        { path: ['dependencyMap', 'nodes'] },
        'Review the dependency draft spec and provider pricing support.'
      )
    );
    return {
      state: 'unpriced',
      estimatedUsd: null,
      reason: message,
      overrideRequired: true,
    };
  }
}
