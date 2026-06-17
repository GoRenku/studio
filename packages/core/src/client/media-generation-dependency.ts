import type { GenerationEstimate } from '@gorenku/studio-engines';
import type { ProjectRelativePath } from './project.js';
import type { ShotVideoTakeInputKind, ShotVideoTakeInputSubjectKind } from './scene-shot-list.js';
import type { MediaGenerationPurpose, MediaKind } from './media-generation-purpose.js';
import type { MediaGenerationSpec } from './media-generation-lifecycle.js';
import type { MediaGenerationTarget } from './media-generation-target.js';

export type MediaGenerationDependencyKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'multi-shot-storyboard-sheet'
  | 'reference-audio'
  | 'cast-character-sheet'
  | 'location-environment-sheet'
  | 'lookbook-sheet'
  | 'manual-attachment';

export type MediaGenerationAssetSelectorId =
  | 'shot-video-input'
  | 'cast-character-sheet'
  | 'location-environment-sheet'
  | 'lookbook-sheet'
  | 'manual-attachment';

export interface MediaGenerationDependencyKindDefinition {
  dependencyKind: MediaGenerationDependencyKind;
  mediaKind: MediaKind;
  cardinality: 'one' | 'many';
  assetSelector: MediaGenerationAssetSelectorId;
  missingInputBehavior: 'plan-generation' | 'require-attachment';
  generationPurpose?: MediaGenerationPurpose;
}

export interface MediaGenerationDependencySlot {
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  label: string;
  dependencyTarget: MediaGenerationTarget;
  selector: MediaGenerationDependencySelectorInput;
  required: boolean;
  defaultIncluded?: boolean;
  reason: string;
}

export type MediaGenerationAssetSelectionPolicy =
  | 'selected-only'
  | 'selected-or-default';

export type MediaGenerationDependencySelectorInput =
    | {
      kind: 'shot-video-input';
      inputKind: ShotVideoTakeInputKind;
      takeGenerationId: string;
      shotIds: string[];
      subjectKind?: ShotVideoTakeInputSubjectKind;
      subjectId?: string;
    }
  | {
      kind: 'asset-relationship';
      target: import('./assets.js').AssetTarget;
      role: string;
      mediaKind: MediaKind;
      fileRole?: string;
      selectionPolicy: MediaGenerationAssetSelectionPolicy;
    }
  | {
      kind: 'lookbook-sheet';
      lookbookId: string;
      lookbookSheetId?: string;
      selectionPolicy: MediaGenerationAssetSelectionPolicy;
    }
  | {
      kind: 'manual-attachment';
      target: MediaGenerationTarget;
    };

export interface MediaGenerationDependencyRequest {
  kind: string;
  [key: string]: unknown;
}

export type MediaGenerationPlanLineSourceKind =
  | 'existing-asset'
  | 'planned-generation'
  | 'external-input-required'
  | 'final-generation';

export type MediaGenerationPlanLineState = 'ready' | 'planned' | 'missing';

export type MediaGenerationDependencyMaterializationState =
  | 'materialized'
  | 'generatable'
  | 'missing-input'
  | 'requires-external-input'
  | 'blocked-by-dependencies'
  | 'invalid-generation-draft';

export type MediaGenerationDependencyPricing =
  | {
      state: 'priced';
      estimatedUsd: number;
    }
  | {
      state: 'unpriced';
      estimatedUsd: null;
      reason: string;
      overrideRequired: true;
    }
  | {
      state: 'not-applicable';
      estimatedUsd: null;
    };

export interface DraftMediaGenerationSpec {
  purpose: MediaGenerationPurpose;
  spec: MediaGenerationSpec;
}

export interface MediaGenerationDependencySelectedAsset {
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
}

export type MediaGenerationDependencyAvailability =
  | { state: 'satisfied' }
  | { state: 'missing-generated' }
  | { state: 'missing-manual' }
  | { state: 'invalid-selection' };

export type MediaGenerationDependencyGenerationDraft =
  | { state: 'not-generated' }
  | { state: 'missing-input'; reason: string }
  | { state: 'authored'; draftGenerationSpec: DraftMediaGenerationSpec }
  | { state: 'blocked'; reason: string };

export interface MediaGenerationDependencyLine {
  id: string;
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  purpose: MediaGenerationPurpose | null;
  target: MediaGenerationTarget | null;
  mediaKind: MediaKind;
  label: string;
  required: boolean;
  requiredBy: string[];
  availability: MediaGenerationDependencyAvailability;
  pricing: MediaGenerationDependencyPricing;
  generationDraft: MediaGenerationDependencyGenerationDraft;
  selectedAsset: MediaGenerationDependencySelectedAsset | null;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface MediaGenerationRootGenerationLine {
  id: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  label: string;
  mediaKind: MediaKind;
  pricing: MediaGenerationDependencyPricing;
  canCreateSpec: boolean;
  blockedReason: string | null;
  estimate: GenerationEstimate | null;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface MediaGenerationDependencyInventoryEstimate {
  state: 'complete' | 'partial' | 'unavailable';
  estimatedTotalUsd: number | null;
  pricedDependencyCount: number;
  unpricedDependencyCount: number;
  unavailableDependencyCount: number;
  requiresPriceOverride: boolean;
}

export interface MediaGenerationDependencyChecklistItem {
  id: string;
  dependencyLineId: string;
  action:
    | 'inspect-existing-asset'
    | 'provide-missing-input'
    | 'generate-dependency'
    | 'import-or-select-asset'
    | 'fix-invalid-selection';
  label: string;
  reason: string;
  pricing: MediaGenerationDependencyPricing;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface MediaGenerationDependencyInventory {
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  dependencies: MediaGenerationDependencyLine[];
  rootGeneration: MediaGenerationRootGenerationLine;
  estimate: MediaGenerationDependencyInventoryEstimate;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
  agentChecklist: MediaGenerationDependencyChecklistItem[];
}

export type MediaGenerationPlanLineKind =
  | 'reused-asset'
  | 'dependency-generation'
  | 'required-attachment'
  | 'final-generation'
  | 'final-video-generation';

export interface MediaGenerationPlanLine {
  id: string;
  dependencyLineId: string;
  kind: MediaGenerationPlanLineKind;
  label: string;
  purpose: MediaGenerationPurpose | null;
  mediaKind: MediaKind;
  dependencyId?: string;
  dependencyKind?: MediaGenerationDependencyKind;
  depth: number;
  state: MediaGenerationPlanLineState;
  materializationState: MediaGenerationDependencyMaterializationState;
  materializationReason?: string;
  pricing: MediaGenerationDependencyPricing;
  required: boolean;
  sourceAssetId?: string;
  draftGenerationSpec?: DraftMediaGenerationSpec;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}

export interface MediaGenerationDependencyPlan {
  rootPurpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  dependencyInventory: MediaGenerationDependencyInventory;
  lines: MediaGenerationPlanLine[];
  estimate: MediaGenerationDependencyInventoryEstimate;
  finalEstimate: GenerationEstimate | null;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}
