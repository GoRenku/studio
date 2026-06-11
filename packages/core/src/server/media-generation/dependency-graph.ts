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
  ): Promise<ResolvedMediaGenerationDependencyAsset | null>;
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
    const existingAsset =
      policyMode === 'regenerate' ? null : await input.resolveExistingAsset(slot);
    const nodeId = existingAsset
      ? `asset:${slot.dependencyId}`
      : definition.generationPurpose
        ? `planned:${slot.dependencyId}`
        : `missing:${slot.dependencyId}`;

    if (nodeIds.has(nodeId)) {
      edges.push({
        fromNodeId: nodeId,
        toNodeId: parentNodeId,
        dependencyId: slot.dependencyId,
      });
      return nodeId;
    }

    nodeIds.add(nodeId);

    if (existingAsset) {
      nodes.push({
        id: nodeId,
        kind: 'existing-asset',
        purpose: definition.generationPurpose ?? null,
        mediaKind: definition.mediaKind,
        label: slot.label,
        state: 'ready',
        pricing: { state: 'priced', estimatedUsd: 0 },
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
    diagnostics.push(missingIssue);
    nodes.push({
      id: nodeId,
      kind: 'external-input-required',
      purpose: null,
      mediaKind: definition.mediaKind,
      label: slot.label,
      state: 'missing',
      pricing: { state: 'not-applicable', estimatedUsd: null },
      dependencyId: slot.dependencyId,
      dependencyKind: slot.dependencyKind,
      ...(slot.dependencyTarget ? { dependencyTarget: slot.dependencyTarget } : {}),
      diagnostics: [missingIssue],
    });
    edges.push({
      fromNodeId: nodeId,
      toNodeId: parentNodeId,
      dependencyId: slot.dependencyId,
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
      draftGenerationSpec = await buildMediaGenerationDependencyDraftSpec({
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
      pricing = await estimateDraftDependency(
        {
          projectName: input.projectName,
          homeDir: input.homeDir,
          draftGenerationSpec,
        },
        diagnostics
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
      diagnostics.push(issue);
      nodeDiagnostics.push(issue);
    }

    nodes.push({
      id: nodeInput.nodeId,
      kind: 'planned-generation',
      purpose: nodeInput.purpose,
      mediaKind: nodeInput.mediaKind,
      label: nodeInput.slot.label,
      state,
      pricing,
      dependencyId: nodeInput.slot.dependencyId,
      dependencyKind: nodeInput.slot.dependencyKind,
      ...(nodeInput.slot.dependencyTarget
        ? { dependencyTarget: nodeInput.slot.dependencyTarget }
        : {}),
      ...(draftGenerationSpec ? { draftGenerationSpec } : {}),
      diagnostics: nodeDiagnostics,
    });
    edges.push({
      fromNodeId: nodeInput.nodeId,
      toNodeId: nodeInput.parentNodeId,
      dependencyId: nodeInput.slot.dependencyId,
    });

    const childSlots = await input.declareDependencies({
      purpose: nodeInput.purpose,
      nodeId: nodeInput.nodeId,
      slot: nodeInput.slot,
    });
    for (const childSlot of childSlots) {
      await addSlotNode(childSlot, nodeInput.nodeId);
    }
  };

  for (const slot of input.slots) {
    await addSlotNode(slot, input.rootNodeId);
  }

  const rootEstimate = await input.estimateRoot();
  diagnostics.push(...rootEstimate.diagnostics);
  nodes.push({
    id: input.rootNodeId,
    kind: 'final-generation',
    purpose: input.rootPurpose,
    mediaKind: input.rootMediaKind,
    label: input.rootLabel,
    state: nodes.some((node) => node.state === 'missing') ? 'missing' : 'planned',
    pricing: rootEstimate.pricing,
    dependencyTarget: input.rootTarget,
    diagnostics: rootEstimate.diagnostics,
  });

  const estimate = aggregateDependencyEstimate(nodes);
  const dependencyLevels = plannedGenerationLevels(nodes, edges);
  const levels = [
    ...dependencyLevels,
    ...(nodes.some((node) => node.state === 'missing') ? [] : [[input.rootNodeId]]),
  ];

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
