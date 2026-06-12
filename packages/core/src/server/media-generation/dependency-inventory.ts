import {
  createDiagnosticError,
  isStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { GenerationEstimate } from '@gorenku/studio-engines';
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
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { requireMediaGenerationDependencyKindDefinition } from './dependency-kind-registry.js';
import {
  buildMediaGenerationDependencyDraftSpec,
  estimateDraftDependency,
} from './dependency-draft-specs.js';
import { aggregateDependencyInventoryEstimate } from './dependency-inventory-lines.js';
import type { MediaGenerationDependencySelectorResult } from './dependency-selectors.js';

const MAX_DEPENDENCY_EXPANSION_DEPTH = 8;

export interface MediaGenerationDependencyRootEstimate {
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
  estimate: GenerationEstimate | null;
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

export async function planMediaGenerationDependencyInventory(
  input: PlanMediaGenerationDependencyInventoryInput
): Promise<{
  dependencyInventory: MediaGenerationDependencyInventory;
  rootEstimate: GenerationEstimate | null;
}> {
  const diagnostics = [...input.diagnostics];
  const linesByDependencyId = new Map<string, MediaGenerationDependencyLine>();
  const expansionStack: string[] = [];

  const addSlotLine = async (
    slot: MediaGenerationDependencySlot,
    parentLineId: string,
    depth: number
  ): Promise<MediaGenerationDependencyLine> => {
    if (depth > MAX_DEPENDENCY_EXPANSION_DEPTH) {
      const issue = createDiagnosticError(
        'CORE_MEDIA_DEPENDENCY_MAX_DEPTH_EXCEEDED',
        `Media generation dependency expansion exceeded ${MAX_DEPENDENCY_EXPANSION_DEPTH} levels.`,
        { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
        'Review dependency slot declarations for unintended recursion.'
      );
      diagnostics.push(issue);
      throw new ProjectDataError(issue.code, issue.message, {
        issues: [issue],
        suggestion: issue.suggestion,
      });
    }
    if (expansionStack.includes(slot.dependencyId)) {
      const issue = createDiagnosticError(
        'CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED',
        `Media generation dependency inventory contains a cycle at ${slot.dependencyId}.`,
        { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
        'Remove the recursive dependency declaration.'
      );
      diagnostics.push(issue);
      throw new ProjectDataError(issue.code, issue.message, {
        issues: [issue],
        suggestion: issue.suggestion,
      });
    }

    const existing = linesByDependencyId.get(slot.dependencyId);
    if (existing) {
      existing.required = existing.required || slot.required;
      if (!existing.requiredBy.includes(parentLineId)) {
        existing.requiredBy.push(parentLineId);
      }
      return existing;
    }

    const line = await resolveSlotLine(slot, parentLineId);
    linesByDependencyId.set(slot.dependencyId, line);

    if (line.availability.state === 'missing-generated' && line.purpose) {
      expansionStack.push(slot.dependencyId);
      const childSlots = await input.declareDependencies({
        purpose: line.purpose,
        lineId: line.id,
        slot,
      });
      for (const childSlot of childSlots) {
        await addSlotLine(childSlot, line.id, depth + 1);
      }
      expansionStack.pop();
    }
    return line;
  };

  const resolveSlotLine = async (
    slot: MediaGenerationDependencySlot,
    parentLineId: string
  ): Promise<MediaGenerationDependencyLine> => {
    const definition = requireMediaGenerationDependencyKindDefinition(
      slot.dependencyKind
    );
    const policyMode = input.inputPolicyMode?.(slot.dependencyId) ?? 'auto';
    const selection =
      policyMode === 'regenerate'
        ? { state: 'missing' as const, asset: null, diagnostics: [] }
        : await input.resolveSelection(slot);
    if (slot.required) {
      diagnostics.push(...selection.diagnostics.filter((issue) => issue.severity === 'error'));
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
      const issue = createDiagnosticError(
        'CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT',
        `Required media generation dependency must be attached before final generation: ${slot.label}.`,
        { path: ['dependencyInventory', 'dependencies', slot.dependencyId] },
        'Attach or select a concrete project asset for this dependency.'
      );
      if (slot.required) {
        diagnostics.push(issue);
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

    return plannedGeneratedDependencyLine({
      slot,
      lineBase,
      purpose: definition.generationPurpose,
    });
  };

  const plannedGeneratedDependencyLine = async (inputLine: {
    slot: MediaGenerationDependencySlot;
    lineBase: Omit<
      MediaGenerationDependencyLine,
      'availability' | 'pricing' | 'generationDraft' | 'selectedAsset'
    >;
    purpose: MediaGenerationPurpose;
  }): Promise<MediaGenerationDependencyLine> => {
    let pricing: MediaGenerationDependencyPricing = {
      state: 'not-applicable',
      estimatedUsd: null,
    };
    let generationDraft: MediaGenerationDependencyLine['generationDraft'] = {
      state: 'blocked',
      reason: 'Dependency draft spec could not be built.',
    };
    const lineDiagnostics: DiagnosticIssue[] = [];

    try {
      const dependencyDraft = await buildMediaGenerationDependencyDraftSpec({
        purpose: inputLine.purpose,
        draftInput: {
          projectName: input.projectName,
          homeDir: input.homeDir,
          rootPurpose: input.rootPurpose,
          rootTarget: input.rootTarget,
          request: input.request,
          dependencyKind: inputLine.slot.dependencyKind,
          dependencyTarget: inputLine.slot.dependencyTarget,
          label: inputLine.slot.label,
          reason: inputLine.slot.reason,
        },
      });
      const pricingDraftGenerationSpec = {
        purpose: dependencyDraft.purpose,
        spec: dependencyDraft.spec,
      };
      generationDraft =
        dependencyDraft.materializationState === 'needs-authored-draft'
          ? {
              state: 'estimate-only',
              reason:
                dependencyDraft.materializationReason ??
                'Author a concrete dependency draft before generation.',
            }
          : {
              state: 'authored',
              draftGenerationSpec: pricingDraftGenerationSpec,
            };
      pricing = await estimateDraftDependency(
        {
          projectName: input.projectName,
          homeDir: input.homeDir,
          draftGenerationSpec: pricingDraftGenerationSpec,
        },
        inputLine.slot.required ? diagnostics : lineDiagnostics
      );
      if (pricing.state === 'unpriced') {
        lineDiagnostics.push(
          createDiagnosticError(
            'CORE_MEDIA_DEPENDENCY_UNPRICED_LINE',
            `Dependency generation is not priced: ${inputLine.slot.label}.`,
            { path: ['dependencyInventory', 'dependencies', inputLine.slot.dependencyId] },
            pricing.reason
          )
        );
      }
    } catch (error) {
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
      const issue = createDiagnosticError(
        code,
        message,
        { path: ['dependencyInventory', 'dependencies', inputLine.slot.dependencyId] },
        suggestion
      );
      if (inputLine.slot.required) {
        diagnostics.push(issue);
      }
      lineDiagnostics.push(issue);
      pricing = {
        state: 'unpriced',
        estimatedUsd: null,
        reason: message,
        overrideRequired: true,
      };
      generationDraft = { state: 'blocked', reason: message };
    }

    return {
      ...inputLine.lineBase,
      availability: { state: 'missing-generated' },
      pricing,
      generationDraft,
      selectedAsset: null,
      diagnostics: [...inputLine.lineBase.diagnostics, ...lineDiagnostics],
    };
  };

  for (const slot of input.slots) {
    await addSlotLine(slot, input.rootLineId, 0);
  }

  const rootEstimate = await input.estimateRoot();
  diagnostics.push(...rootEstimate.diagnostics);
  const dependencies = [...linesByDependencyId.values()];
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
    diagnostics,
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
  if (line.generationDraft.state === 'estimate-only') {
    return 'author-generation-draft';
  }
  return 'generate-dependency';
}
