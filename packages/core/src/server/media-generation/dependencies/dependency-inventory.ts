import {
  createDiagnosticError,
  isStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import type {
  MediaGenerationDependencyInventory,
  MediaGenerationDependencyLine,
  MediaGenerationDependencyPricing,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySlot,
  MediaGenerationPurpose,
  MediaGenerationRootGenerationLine,
  MediaGenerationTarget,
  MediaKind,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { requireMediaGenerationDependencyKindDefinition } from './dependency-kind-registry.js';
import { estimateMediaGenerationDependencyDraft } from '../cost/dependency-draft-estimates.js';
import { planMediaGenerationDependencyDraft } from './dependency-draft-specs.js';
import { aggregateDependencyInventoryEstimate } from './dependency-inventory-lines.js';
import type { MediaGenerationDependencySelectorResult } from './dependency-selectors.js';

const MAX_DEPENDENCY_EXPANSION_DEPTH = 8;

export interface MediaGenerationDependencyRootEstimate {
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
  estimate: GenerationCostEstimate | null;
}

export interface PlanMediaGenerationDependencyInventoryInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  rootLineId: string;
  rootLabel: string;
  rootMediaKind: MediaKind;
  request: MediaGenerationDependencyRequest;
  slots: MediaGenerationDependencySlot[];
  diagnostics: DiagnosticIssue[];
  resolveSelection(
    slot: MediaGenerationDependencySlot
  ): Promise<MediaGenerationDependencySelectorResult>;
  declareDependencies(input: {
    purpose: MediaGenerationPurpose;
    lineId: string;
    slot: MediaGenerationDependencySlot;
  }): Promise<MediaGenerationDependencySlot[]>;
  estimateRoot(): Promise<MediaGenerationDependencyRootEstimate>;
  inputPolicyMode?(dependencyId: string): 'reuse-selected' | 'regenerate' | 'auto';
}

interface DependencyInventoryPlannerState {
  input: PlanMediaGenerationDependencyInventoryInput;
  diagnostics: DiagnosticIssue[];
  linesByDependencyId: Map<string, MediaGenerationDependencyLine>;
  declarationsByDependencyId: Map<string, MediaGenerationDependencySlot>;
  expansionStack: string[];
}

export async function planMediaGenerationDependencyInventory(
  input: PlanMediaGenerationDependencyInventoryInput
): Promise<{
  dependencyInventory: MediaGenerationDependencyInventory;
  rootEstimate: GenerationCostEstimate | null;
}> {
  const state = createDependencyInventoryPlannerState(input);

  for (const slot of input.slots) {
    await addDependencySlotLine(state, slot, input.rootLineId, 0);
  }

  const rootEstimate = await input.estimateRoot();
  state.diagnostics.push(...rootEstimate.diagnostics);
  const dependencies = [...state.linesByDependencyId.values()];
  const unresolvedRequired = dependencies.filter(
    (line) =>
      line.required &&
      (line.availability.state === 'missing-generated' ||
        line.availability.state === 'missing-manual' ||
        line.availability.state === 'invalid-selection')
  );
  const rootGeneration: MediaGenerationRootGenerationLine = {
    id: input.rootLineId,
    purpose: input.rootPurpose,
    target: input.rootTarget,
    label: input.rootLabel,
    mediaKind: input.rootMediaKind,
    pricing: rootEstimate.pricing,
    canCreateSpec: unresolvedRequired.length === 0,
    blockedReason:
      unresolvedRequired.length > 0
        ? 'Generate, import, or author required dependencies before creating the final generation.'
        : null,
    estimate: rootEstimate.estimate,
    diagnostics: rootEstimate.diagnostics,
  };
  const dependencyInventory: MediaGenerationDependencyInventory = {
    rootPurpose: input.rootPurpose,
    rootTarget: input.rootTarget,
    dependencies,
    rootGeneration,
    estimate: aggregateDependencyInventoryEstimate({
      dependencies,
      rootGeneration,
    }),
    diagnostics: state.diagnostics,
    agentChecklist: dependencies.map((line) => ({
      id: `checklist:${line.id}`,
      dependencyLineId: line.id,
      action: checklistAction(line),
      label: line.label,
      reason: line.requiredBy.length > 0 ? line.requiredBy.join(', ') : line.label,
      pricing: line.pricing,
      diagnostics: line.diagnostics,
    })),
  };

  return {
    dependencyInventory,
    rootEstimate: rootEstimate.estimate,
  };
}

function createDependencyInventoryPlannerState(
  input: PlanMediaGenerationDependencyInventoryInput
): DependencyInventoryPlannerState {
  return {
    input,
    diagnostics: [...input.diagnostics],
    linesByDependencyId: new Map(),
    declarationsByDependencyId: new Map(),
    expansionStack: [],
  };
}

async function addDependencySlotLine(
  state: DependencyInventoryPlannerState,
  slot: MediaGenerationDependencySlot,
  parentLineId: string,
  depth: number
): Promise<MediaGenerationDependencyLine> {
  validateDependencyExpansionDepth(state, slot, depth);
  validateDependencyCycle(state, slot);

  const existing = state.linesByDependencyId.get(slot.dependencyId);
  if (existing) {
    const existingDeclaration = state.declarationsByDependencyId.get(slot.dependencyId);
    validateDuplicateDependencyDeclaration(existingDeclaration, slot, parentLineId);
    existing.required = existing.required || slot.required;
    if (!existing.requiredBy.includes(parentLineId)) {
      existing.requiredBy.push(parentLineId);
    }
    return existing;
  }

  const line = await resolveDependencySlotLine(state, slot, parentLineId);
  state.linesByDependencyId.set(slot.dependencyId, line);
  state.declarationsByDependencyId.set(slot.dependencyId, slot);

  if (line.availability.state === 'missing-generated' && line.purpose) {
    state.expansionStack.push(slot.dependencyId);
    const childSlots = await state.input.declareDependencies({
      purpose: line.purpose,
      lineId: line.id,
      slot,
    });
    for (const childSlot of childSlots) {
      await addDependencySlotLine(state, childSlot, line.id, depth + 1);
    }
    state.expansionStack.pop();
  }
  return line;
}

function validateDependencyExpansionDepth(
  state: DependencyInventoryPlannerState,
  slot: MediaGenerationDependencySlot,
  depth: number
): void {
  if (depth <= MAX_DEPENDENCY_EXPANSION_DEPTH) {
    return;
  }
  const issue = createDiagnosticError(
    'CORE_MEDIA_DEPENDENCY_MAX_DEPTH_EXCEEDED',
    `Media generation dependency expansion exceeded ${MAX_DEPENDENCY_EXPANSION_DEPTH} levels.`,
    { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
    'Review dependency slot declarations for unintended recursion.'
  );
  state.diagnostics.push(issue);
  throw new ProjectDataError(issue.code, issue.message, {
    issues: [issue],
    suggestion: issue.suggestion,
  });
}

function validateDependencyCycle(
  state: DependencyInventoryPlannerState,
  slot: MediaGenerationDependencySlot
): void {
  if (!state.expansionStack.includes(slot.dependencyId)) {
    return;
  }
  const issue = createDiagnosticError(
    'CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED',
    `Media generation dependency inventory contains a cycle at ${slot.dependencyId}.`,
    { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
    'Remove the recursive dependency declaration.'
  );
  state.diagnostics.push(issue);
  throw new ProjectDataError(issue.code, issue.message, {
    issues: [issue],
    suggestion: issue.suggestion,
  });
}

async function resolveDependencySlotLine(
  state: DependencyInventoryPlannerState,
  slot: MediaGenerationDependencySlot,
  parentLineId: string
): Promise<MediaGenerationDependencyLine> {
  const definition = requireMediaGenerationDependencyKindDefinition(
    slot.dependencyKind
  );
  const policyMode = state.input.inputPolicyMode?.(slot.dependencyId) ?? 'auto';
  const selection =
    policyMode === 'regenerate'
      ? { state: 'missing' as const, asset: null, diagnostics: [] }
      : await state.input.resolveSelection(slot);
  if (slot.required) {
    state.diagnostics.push(
      ...selection.diagnostics.filter((issue) => issue.severity === 'error')
    );
  }

  const lineBase = {
    id: `dependency:${slot.dependencyId}`,
    dependencyId: slot.dependencyId,
    dependencyKind: slot.dependencyKind,
    purpose: definition.generationPurpose ?? null,
    target: slot.dependencyTarget,
    mediaKind: definition.mediaKind,
    label: slot.label,
    required: slot.required,
    requiredBy: [parentLineId],
    diagnostics: selection.diagnostics,
  };

  if (selection.state === 'invalid-selection') {
    return {
      ...lineBase,
      availability: { state: 'invalid-selection' },
      pricing: { state: 'not-applicable', estimatedUsd: null },
      generationDraft: {
        state: 'blocked',
        reason: 'Resolve the selected asset before this dependency can be planned.',
      },
      selectedAsset: null,
    };
  }

  if (selection.state === 'satisfied') {
    return {
      ...lineBase,
      availability: { state: 'satisfied' },
      pricing: { state: 'priced', estimatedUsd: 0 },
      generationDraft: { state: 'not-generated' },
      selectedAsset: selection.asset,
    };
  }

  if (!definition.generationPurpose) {
    return missingManualDependencyLine(state, slot, lineBase);
  }

  return plannedGeneratedDependencyLine(state, {
    slot,
    lineBase,
    purpose: definition.generationPurpose,
  });
}

function missingManualDependencyLine(
  state: DependencyInventoryPlannerState,
  slot: MediaGenerationDependencySlot,
  lineBase: Omit<
    MediaGenerationDependencyLine,
    'availability' | 'pricing' | 'generationDraft' | 'selectedAsset'
  >
): MediaGenerationDependencyLine {
  const issue = createDiagnosticError(
    'CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT',
    `Required media generation dependency must be attached before final generation: ${slot.label}.`,
    { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
    'Attach or select a concrete project asset for this dependency.'
  );
  if (slot.required) {
    state.diagnostics.push(issue);
  }
  return {
    ...lineBase,
    availability: { state: 'missing-manual' },
    pricing: { state: 'not-applicable', estimatedUsd: null },
    generationDraft: {
      state: 'blocked',
      reason: 'Attach or select a concrete project asset for this dependency.',
    },
    selectedAsset: null,
    diagnostics: [issue],
  };
}

async function plannedGeneratedDependencyLine(
  state: DependencyInventoryPlannerState,
  inputLine: {
    slot: MediaGenerationDependencySlot;
    lineBase: Omit<
      MediaGenerationDependencyLine,
      'availability' | 'pricing' | 'generationDraft' | 'selectedAsset'
    >;
    purpose: MediaGenerationPurpose;
  }
): Promise<MediaGenerationDependencyLine> {
  let pricing: MediaGenerationDependencyPricing = {
    state: 'unpriced',
    estimatedUsd: null,
    reason: 'Dependency draft spec has not been estimated yet.',
    overrideRequired: true,
  };
  let generationDraft: MediaGenerationDependencyLine['generationDraft'] = {
    state: 'blocked',
    reason: 'Dependency draft spec could not be built.',
  };
  const lineDiagnostics: DiagnosticIssue[] = [];

  try {
    const dependencyDraft = await planMediaGenerationDependencyDraft({
      purpose: inputLine.purpose,
      draftInput: {
        projectName: state.input.projectName,
        homeDir: state.input.homeDir,
        rootPurpose: state.input.rootPurpose,
        rootTarget: state.input.rootTarget,
        request: state.input.request,
        dependencyKind: inputLine.slot.dependencyKind,
        dependencyTarget: inputLine.slot.dependencyTarget,
        label: inputLine.slot.label,
        reason: inputLine.slot.reason,
      },
    });
    if (dependencyDraft.materializationState === 'missing-input') {
      pricing = dependencyDraft.pricing;
      generationDraft = {
        state: 'missing-input',
        reason: dependencyDraft.materializationReason,
      };
      lineDiagnostics.push(...(dependencyDraft.diagnostics ?? []));
      if (inputLine.slot.required) {
        state.diagnostics.push(
          ...(dependencyDraft.diagnostics ?? []).filter(
            (issue) => issue.severity === 'error'
          )
        );
      }
      return {
        ...inputLine.lineBase,
        availability: { state: 'missing-generated' },
        pricing,
        generationDraft,
        selectedAsset: null,
        diagnostics: [...inputLine.lineBase.diagnostics, ...lineDiagnostics],
      };
    }
    const pricingDraftGenerationSpec = {
      purpose: dependencyDraft.purpose,
      spec: dependencyDraft.spec,
    };
    generationDraft = {
      state: 'authored',
      draftGenerationSpec: pricingDraftGenerationSpec,
    };
    const estimateResult = await estimateMediaGenerationDependencyDraft({
      projectName: state.input.projectName,
      homeDir: state.input.homeDir,
      draftGenerationSpec: pricingDraftGenerationSpec,
      dependencyId: inputLine.slot.dependencyId,
      label: inputLine.slot.label,
    });
    pricing = estimateResult.pricing;
    lineDiagnostics.push(...estimateResult.diagnostics);
    if (inputLine.slot.required) {
      state.diagnostics.push(
        ...estimateResult.diagnostics.filter((issue) => issue.severity === 'error')
      );
    }
  } catch (error) {
    const issue = dependencyDraftFailureIssue(inputLine.slot, error);
    if (inputLine.slot.required) {
      state.diagnostics.push(issue);
    }
    lineDiagnostics.push(issue);
    pricing = {
      state: 'unpriced',
      estimatedUsd: null,
      reason: issue.message,
      overrideRequired: true,
    };
    generationDraft = { state: 'blocked', reason: issue.message };
  }

  return {
    ...inputLine.lineBase,
    availability: { state: 'missing-generated' },
    pricing,
    generationDraft,
    selectedAsset: null,
    diagnostics: [...inputLine.lineBase.diagnostics, ...lineDiagnostics],
  };
}

function dependencyDraftFailureIssue(
  slot: MediaGenerationDependencySlot,
  error: unknown
): DiagnosticIssue {
  const message =
    error instanceof Error
      ? error.message
      : 'Dependency draft spec could not be built.';
  const code = isStructuredError(error)
    ? error.code
    : 'CORE_MEDIA_DEPENDENCY_MISSING_DRAFT_BUILDER';
  const suggestion = isStructuredError(error)
    ? error.suggestion
    : 'Add a dependency draft builder to the media generation purpose that owns this dependency.';
  return createDiagnosticError(
    code,
    message,
    { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
    suggestion
  );
}

function validateDuplicateDependencyDeclaration(
  existing: MediaGenerationDependencySlot | undefined,
  slot: MediaGenerationDependencySlot,
  parentLineId: string
): void {
  if (!existing) {
    return;
  }
  const conflicts = [
    existing.dependencyKind !== slot.dependencyKind ? 'dependency kind' : null,
    !sameJson(existing.dependencyTarget, slot.dependencyTarget) ? 'target' : null,
    !sameJson(existing.selector, slot.selector) ? 'selector' : null,
    existing.label !== slot.label ? 'label' : null,
  ].filter((conflict): conflict is string => Boolean(conflict));

  if (conflicts.length === 0) {
    return;
  }

  const issue = createDiagnosticError(
    'CORE_MEDIA_DEPENDENCY_CONFLICTING_DECLARATION',
    `Dependency ${slot.dependencyId} was declared more than once with conflicting ${conflicts.join(', ')}.`,
    { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
    `Review dependency declarations for ${parentLineId} and keep one structural definition for this dependency id.`
  );
  throw new ProjectDataError(issue.code, issue.message, {
    issues: [issue],
    suggestion: issue.suggestion,
  });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function checklistAction(
  line: MediaGenerationDependencyLine
): MediaGenerationDependencyInventory['agentChecklist'][number]['action'] {
  if (line.availability.state === 'satisfied') {
    return 'inspect-existing-asset';
  }
  if (line.availability.state === 'missing-manual') {
    return 'import-or-select-asset';
  }
  if (line.availability.state === 'invalid-selection') {
    return 'fix-invalid-selection';
  }
  if (line.generationDraft.state === 'missing-input') {
    return 'provide-missing-input';
  }
  return 'generate-dependency';
}
