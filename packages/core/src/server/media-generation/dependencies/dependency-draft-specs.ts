import type {
  MediaGenerationDependencyPricing,
  MediaGenerationDependencyKind,
  MediaGenerationDependencyMaterializationState,
  MediaGenerationDependencyRequest,
  MediaGenerationPurpose,
  MediaGenerationSpec,
  MediaGenerationTarget,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { requireMediaGenerationPurposeDefinition } from '../lifecycle/purpose-lifecycle-registry.js';

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
  materializationState: Extract<
    MediaGenerationDependencyMaterializationState,
    'generatable'
  >;
  materializationReason?: string;
}

export type MediaGenerationDependencyDraftPlan =
  | MediaGenerationDependencyDraftSpec
  | {
      materializationState: Extract<
        MediaGenerationDependencyMaterializationState,
        'missing-input'
      >;
      materializationReason: string;
      pricing: MediaGenerationDependencyPricing;
      estimate: import('@gorenku/studio-engines').GenerationCostEstimate | null;
      diagnostics?: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
    };

export async function planMediaGenerationDependencyDraft(input: {
  purpose: MediaGenerationPurpose;
  draftInput: MediaGenerationDependencyDraftSpecInput;
}): Promise<MediaGenerationDependencyDraftPlan> {
  const definition = requireMediaGenerationPurposeDefinition(input.purpose);
  if (!definition.planDependencyDraft) {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_MISSING_DRAFT_BUILDER',
      `Media generation purpose has no dependency draft builder: ${input.purpose}.`,
      {
        suggestion:
          'Add planDependencyDraft to the purpose that owns this generated dependency.',
      }
    );
  }
  const draft = await definition.planDependencyDraft(input.draftInput);
  if (!draft.materializationState) {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_DRAFT_MATERIALIZATION_STATE_MISSING',
      `Dependency draft builder did not declare a materialization state for ${input.purpose}.`,
      {
        suggestion:
          'Return generatable or missing-input from the dependency draft builder.',
      }
    );
  }
  if (draft.materializationState === 'missing-input') {
    return {
      materializationState: draft.materializationState,
      materializationReason: draft.materializationReason,
      pricing: draft.pricing,
      estimate: draft.estimate,
      ...(draft.diagnostics ? { diagnostics: draft.diagnostics } : {}),
    };
  }
  return {
    purpose: draft.purpose,
    spec: draft.spec,
    materializationState: draft.materializationState,
    ...(draft.materializationReason
      ? { materializationReason: draft.materializationReason }
      : {}),
  };
}
