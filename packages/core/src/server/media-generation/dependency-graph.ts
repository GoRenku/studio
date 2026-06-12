import {
  createDiagnosticError,
  isStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { GenerationEstimate } from '@gorenku/studio-engines';
import type {
  MediaGenerationDependencyMap,
  MediaGenerationDependencyNode,
  MediaGenerationDependencyPricing,
  MediaGenerationDependencyRequest,
  MediaGenerationDependencySlot,
  MediaGenerationPurpose,
  MediaGenerationTarget,
  MediaKind,
} from '../../client/index.js';
import { requireMediaGenerationDependencyKindDefinition } from './dependency-kind-registry.js';
import {
  aggregateDependencyEstimate,
  plannedGenerationLevels,
} from './dependency-plan-lines.js';
import {
  buildMediaGenerationDependencyDraftSpec,
  estimateDraftDependency,
} from './dependency-draft-specs.js';
import { ProjectDataError } from '../project-data-error.js';

export interface ResolvedMediaGenerationDependencyAsset {
  assetId: string;
  assetFileId: string;
}

export interface MediaGenerationDependencyAssetResolution {
  asset: ResolvedMediaGenerationDependencyAsset | null;
  diagnostics: DiagnosticIssue[];
}

export interface MediaGenerationDependencyRootEstimate {
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
  estimate: GenerationEstimate | null;
}

export interface ResolveMediaGenerationDependencyGraphInput {
  projectName?: string;
  homeDir?: string;
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  rootNodeId: string;
  rootLabel: string;
  rootMediaKind: MediaKind;
  request: MediaGenerationDependencyRequest;
  slots: MediaGenerationDependencySlot[];
  diagnostics: DiagnosticIssue[];
  resolveExistingAsset(
    slot: MediaGenerationDependencySlot
  ): Promise<MediaGenerationDependencyAssetResolution>;
  declareDependencies(input: {
    purpose: MediaGenerationPurpose;
    nodeId: string;
    slot: MediaGenerationDependencySlot;
  }): Promise<MediaGenerationDependencySlot[]>;
  estimateRoot(): Promise<MediaGenerationDependencyRootEstimate>;
  inputPolicyMode?(dependencyId: string): 'reuse-selected' | 'regenerate' | 'auto';
}

export interface ResolveMediaGenerationDependencyGraphResult {
  dependencyMap: MediaGenerationDependencyMap;
  rootEstimate: GenerationEstimate | null;
}

export async function resolveMediaGenerationDependencyGraph(
  input: ResolveMediaGenerationDependencyGraphInput
): Promise<ResolveMediaGenerationDependencyGraphResult> {
  const nodes: MediaGenerationDependencyNode[] = [];
  const edges: MediaGenerationDependencyMap['edges'] = [];
  const diagnostics = [...input.diagnostics];
  const nodeIds = new Set<string>();

  const addSlotNode = async (
    slot: MediaGenerationDependencySlot,
    parentNodeId: string
  ): Promise<string> => {
    const definition = requireMediaGenerationDependencyKindDefinition(
      slot.dependencyKind
    );
    const policyMode = input.inputPolicyMode?.(slot.dependencyId) ?? 'auto';
    const resolution =
      policyMode === 'regenerate'
        ? { asset: null, diagnostics: [] }
        : await input.resolveExistingAsset(slot);
    if (slot.required) {
      diagnostics.push(...resolution.diagnostics);
    }
    const blockingSelectorDiagnostics = resolution.diagnostics.filter(
      (issue) => issue.severity === 'error'
    );
    const existingAsset = resolution.asset;
    const nodeId = existingAsset
      ? `asset:${slot.dependencyId}`
      : blockingSelectorDiagnostics.length > 0
        ? `missing:${slot.dependencyId}`
        : definition.generationPurpose
        ? `planned:${slot.dependencyId}`
        : `missing:${slot.dependencyId}`;

    if (nodeIds.has(nodeId)) {
      edges.push({
        fromNodeId: nodeId,
        toNodeId: parentNodeId,
        dependencyId: slot.dependencyId,
        required: slot.required,
      });
      return nodeId;
    }

    nodeIds.add(nodeId);

    if (blockingSelectorDiagnostics.length > 0) {
      nodes.push({
        id: nodeId,
        kind: 'external-input-required',
        purpose: definition.generationPurpose ?? null,
        mediaKind: definition.mediaKind,
        label: slot.label,
        state: 'missing',
        materializationState: 'requires-external-input',
        materializationReason:
          'Resolve the selected asset before this dependency can be planned.',
        pricing: { state: 'not-applicable', estimatedUsd: null },
        required: slot.required,
        dependencyId: slot.dependencyId,
        dependencyKind: slot.dependencyKind,
        ...(slot.dependencyTarget ? { dependencyTarget: slot.dependencyTarget } : {}),
        diagnostics: blockingSelectorDiagnostics,
      });
      edges.push({
        fromNodeId: nodeId,
        toNodeId: parentNodeId,
        dependencyId: slot.dependencyId,
        required: slot.required,
      });
      return nodeId;
    }

    if (existingAsset) {
      nodes.push({
        id: nodeId,
        kind: 'existing-asset',
        purpose: definition.generationPurpose ?? null,
        mediaKind: definition.mediaKind,
        label: slot.label,
        state: 'ready',
        materializationState: 'materialized',
        pricing: { state: 'priced', estimatedUsd: 0 },
        required: slot.required,
        dependencyId: slot.dependencyId,
        dependencyKind: slot.dependencyKind,
        ...(slot.dependencyTarget ? { dependencyTarget: slot.dependencyTarget } : {}),
        assetId: existingAsset.assetId,
        assetFileId: existingAsset.assetFileId,
        diagnostics: [],
      });
      edges.push({
        fromNodeId: nodeId,
        toNodeId: parentNodeId,
        dependencyId: slot.dependencyId,
        required: slot.required,
      });
      return nodeId;
    }

    if (definition.generationPurpose) {
      await addPlannedGenerationNode({
        nodeId,
        parentNodeId,
        slot,
        purpose: definition.generationPurpose,
        mediaKind: definition.mediaKind,
      });
      return nodeId;
    }

    const missingIssue = createDiagnosticError(
      'CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT',
      `Required media generation dependency must be attached before final generation: ${slot.label}.`,
      { path: ['dependencyMap', 'nodes', nodeId] },
      'Attach or select a concrete project asset for this dependency.'
    );
    if (slot.required) {
      diagnostics.push(missingIssue);
    }
    nodes.push({
      id: nodeId,
      kind: 'external-input-required',
      purpose: null,
      mediaKind: definition.mediaKind,
      label: slot.label,
      state: 'missing',
      materializationState: 'requires-external-input',
      materializationReason:
        'Attach or select a concrete project asset for this dependency.',
      pricing: { state: 'not-applicable', estimatedUsd: null },
      required: slot.required,
      dependencyId: slot.dependencyId,
      dependencyKind: slot.dependencyKind,
      ...(slot.dependencyTarget ? { dependencyTarget: slot.dependencyTarget } : {}),
      diagnostics: [missingIssue],
    });
    edges.push({
      fromNodeId: nodeId,
      toNodeId: parentNodeId,
      dependencyId: slot.dependencyId,
      required: slot.required,
    });
    return nodeId;
  };

  const addPlannedGenerationNode = async (nodeInput: {
    nodeId: string;
    parentNodeId: string;
    slot: MediaGenerationDependencySlot;
    purpose: MediaGenerationPurpose;
    mediaKind: MediaKind;
  }) => {
    let draftGenerationSpec: MediaGenerationDependencyNode['draftGenerationSpec'] | null = null;
    let materializationState: MediaGenerationDependencyNode['materializationState'] = 'invalid-generation-draft';
    let materializationReason: string | null = null;
    let pricing: MediaGenerationDependencyPricing = {
      state: 'not-applicable',
      estimatedUsd: null,
    };
    let state: MediaGenerationDependencyNode['state'] = 'missing';
    const nodeDiagnostics: DiagnosticIssue[] = [];

    try {
      if (!nodeInput.slot.dependencyTarget) {
        throw new ProjectDataError(
          'CORE_MEDIA_DEPENDENCY_MISSING_GENERATION_TARGET',
          `Dependency ${nodeInput.slot.dependencyId} has no generation target.`,
          {
            suggestion:
              'Declare a dependencyTarget for generated dependency slots.',
          }
        );
      }
      const dependencyDraft = await buildMediaGenerationDependencyDraftSpec({
        purpose: nodeInput.purpose,
        draftInput: {
          projectName: input.projectName,
          homeDir: input.homeDir,
          rootPurpose: input.rootPurpose,
          rootTarget: input.rootTarget,
          request: input.request,
          dependencyKind: nodeInput.slot.dependencyKind,
          dependencyTarget: nodeInput.slot.dependencyTarget,
          label: nodeInput.slot.label,
          reason: nodeInput.slot.reason,
        },
      });
      materializationState = dependencyDraft.materializationState ?? 'generatable';
      materializationReason = dependencyDraft.materializationReason ?? null;
      const pricingDraftGenerationSpec = {
        purpose: dependencyDraft.purpose,
        spec: dependencyDraft.spec,
      };
      if (materializationState === 'generatable') {
        draftGenerationSpec = pricingDraftGenerationSpec;
      }
      pricing = await estimateDraftDependency(
        {
          projectName: input.projectName,
          homeDir: input.homeDir,
          draftGenerationSpec: pricingDraftGenerationSpec,
        },
        nodeInput.slot.required ? diagnostics : nodeDiagnostics
      );
      state = 'planned';
      if (pricing.state === 'unpriced') {
        nodeDiagnostics.push(
          createDiagnosticError(
            'CORE_MEDIA_DEPENDENCY_UNPRICED_NODE',
            `Dependency generation is not priced: ${nodeInput.slot.label}.`,
            { path: ['dependencyMap', 'nodes', nodeInput.nodeId] },
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
        { path: ['dependencyMap', 'nodes', nodeInput.nodeId] },
        suggestion
      );
      if (nodeInput.slot.required) {
        diagnostics.push(issue);
      }
      nodeDiagnostics.push(issue);
      materializationReason = message;
    }

    const plannedNode: MediaGenerationDependencyNode = {
      id: nodeInput.nodeId,
      kind: 'planned-generation',
      purpose: nodeInput.purpose,
      mediaKind: nodeInput.mediaKind,
      label: nodeInput.slot.label,
      state,
      materializationState,
      ...(materializationReason ? { materializationReason } : {}),
      pricing,
      required: nodeInput.slot.required,
      dependencyId: nodeInput.slot.dependencyId,
      dependencyKind: nodeInput.slot.dependencyKind,
      ...(nodeInput.slot.dependencyTarget
        ? { dependencyTarget: nodeInput.slot.dependencyTarget }
        : {}),
      ...(draftGenerationSpec ? { draftGenerationSpec } : {}),
      diagnostics: nodeDiagnostics,
    };
    nodes.push(plannedNode);
    edges.push({
      fromNodeId: nodeInput.nodeId,
      toNodeId: nodeInput.parentNodeId,
      dependencyId: nodeInput.slot.dependencyId,
      required: nodeInput.slot.required,
    });

    const childSlots = await input.declareDependencies({
      purpose: nodeInput.purpose,
      nodeId: nodeInput.nodeId,
      slot: nodeInput.slot,
    });
    const childNodeIds: Array<{ nodeId: string; required: boolean }> = [];
    for (const childSlot of childSlots) {
      childNodeIds.push({
        nodeId: await addSlotNode(childSlot, nodeInput.nodeId),
        required: childSlot.required,
      });
    }
    const blockedByChild = childNodeIds.some(({ nodeId, required }) => {
      if (!required) {
        return false;
      }
      const childNode = nodes.find((node) => node.id === nodeId);
      return Boolean(
        childNode &&
          (childNode.state === 'missing' ||
            childNode.materializationState === 'needs-authored-draft' ||
            childNode.materializationState === 'requires-external-input' ||
            childNode.materializationState === 'blocked-by-dependencies' ||
            childNode.materializationState === 'invalid-generation-draft')
      );
    });
    if (blockedByChild && plannedNode.materializationState === 'generatable') {
      plannedNode.materializationState = 'blocked-by-dependencies';
      plannedNode.materializationReason =
        'Resolve required child dependencies before generating this dependency.';
      delete plannedNode.draftGenerationSpec;
    }
  };

  for (const slot of input.slots) {
    await addSlotNode(slot, input.rootNodeId);
  }

  const rootEstimate = await input.estimateRoot();
  diagnostics.push(...rootEstimate.diagnostics);
  const rootMaterializationState = nodes.some(
    (node) =>
      node.required &&
      (node.kind === 'planned-generation' ||
        node.kind === 'external-input-required' ||
        node.materializationState === 'needs-authored-draft' ||
        node.materializationState === 'requires-external-input' ||
        node.materializationState === 'invalid-generation-draft' ||
        node.materializationState === 'blocked-by-dependencies' ||
        node.state === 'missing')
  )
    ? 'blocked-by-dependencies'
    : 'generatable';
  nodes.push({
    id: input.rootNodeId,
    kind: 'final-generation',
    purpose: input.rootPurpose,
    mediaKind: input.rootMediaKind,
    label: input.rootLabel,
    state: rootEstimate.pricing.state === 'not-applicable' ? 'missing' : 'planned',
    materializationState: rootMaterializationState,
    ...(rootMaterializationState === 'blocked-by-dependencies'
      ? {
          materializationReason:
            'Generate, import, or author required dependencies before creating the final generation.',
        }
      : {}),
    pricing: rootEstimate.pricing,
    required: true,
    dependencyTarget: input.rootTarget,
    diagnostics: rootEstimate.diagnostics,
  });

  const estimate = aggregateDependencyEstimate(nodes);
  const dependencyLevels = plannedGenerationLevels(nodes, edges);
  const levels = [...dependencyLevels];
  if (rootMaterializationState === 'generatable') {
    if (levels.length > 0) {
      levels[0] = [input.rootNodeId, ...levels[0]];
    } else {
      levels.push([input.rootNodeId]);
    }
  }

  return {
    dependencyMap: {
      rootPurpose: input.rootPurpose,
      nodes,
      edges,
      estimate,
      execution: {
        topologicalNodeIds: levels.flat(),
        levels,
        diagnostics: [],
      },
      diagnostics,
    },
    rootEstimate: rootEstimate.estimate,
  };
}
