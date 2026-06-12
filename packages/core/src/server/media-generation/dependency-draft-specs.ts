import type {
  MediaGenerationDependencyKind,
  MediaGenerationDependencyMaterializationState,
  MediaGenerationDependencyRequest,
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
  materializationState: Extract<
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
  if (!draft.materializationState) {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_DRAFT_MATERIALIZATION_STATE_MISSING',
      `Dependency draft builder did not declare a materialization state for ${input.purpose}.`,
      {
        suggestion:
          'Return generatable or needs-authored-draft from the dependency draft builder.',
      }
    );
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
