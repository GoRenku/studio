import type {
  MediaGenerationDependencyMap,
  MediaGenerationDependencyNode,
  MediaGenerationPlanLine,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function aggregateDependencyEstimate(
  nodes: MediaGenerationDependencyNode[]
): MediaGenerationDependencyMap['estimate'] {
  const priced = nodes.filter(
    (node): node is MediaGenerationDependencyNode & {
      pricing: { state: 'priced'; estimatedUsd: number };
    } => node.pricing.state === 'priced'
  );
  const unpriced = nodes.filter((node) => node.pricing.state === 'unpriced');
  const missing = nodes.filter((node) => node.state === 'missing');
  const total = priced.reduce((sum, node) => sum + node.pricing.estimatedUsd, 0);
  return {
    state: missing.length > 0 ? 'unavailable' : unpriced.length > 0 ? 'partial' : 'complete',
    estimatedTotalUsd: missing.length > 0 ? null : total,
    pricedNodeCount: priced.length,
    unpricedNodeCount: unpriced.length,
    missingNodeCount: missing.length,
    requiresPriceOverride: unpriced.length > 0,
  };
}

export function plannedGenerationLevels(
  nodes: MediaGenerationDependencyNode[],
  edges: MediaGenerationDependencyMap['edges']
): string[][] {
  const plannedNodeIds = new Set(
    nodes
      .filter((node) => node.kind === 'planned-generation' && node.state === 'planned')
      .map((node) => node.id)
  );
  const unresolved = new Set(plannedNodeIds);
  const levels: string[][] = [];

  while (unresolved.size > 0) {
    const level = [...unresolved].filter((nodeId) =>
      edges
        .filter((edge) => edge.toNodeId === nodeId)
        .every(
          (edge) =>
            !plannedNodeIds.has(edge.fromNodeId) || !unresolved.has(edge.fromNodeId)
        )
    );
    if (level.length === 0) {
      throw new ProjectDataError(
        'CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED',
        'Media generation dependency graph contains a cycle.'
      );
    }
    levels.push(level);
    level.forEach((nodeId) => unresolved.delete(nodeId));
  }

  return levels;
}

export function planLinesFromDependencyMap(
  dependencyMap: MediaGenerationDependencyMap
): MediaGenerationPlanLine[] {
  const orderedNodeIds = [
    ...dependencyMap.execution.topologicalNodeIds,
    ...dependencyMap.nodes
      .map((node) => node.id)
      .filter((nodeId) => !dependencyMap.execution.topologicalNodeIds.includes(nodeId)),
  ];
  const nodesById = new Map(dependencyMap.nodes.map((node) => [node.id, node]));
  const depths = dependencyDepths(dependencyMap);
  return orderedNodeIds.flatMap((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return [];
    }
    return [
      {
        id: `line:${node.id}`,
        nodeId: node.id,
        kind: planLineKind(node),
        label: node.label,
        purpose: node.purpose,
        mediaKind: node.mediaKind,
        ...(node.dependencyId ? { dependencyId: node.dependencyId } : {}),
        ...(node.dependencyKind ? { dependencyKind: node.dependencyKind } : {}),
        depth: depths.get(node.id) ?? 0,
        state: node.state,
        pricing: node.pricing,
        ...(node.assetId ? { sourceAssetId: node.assetId } : {}),
        ...(node.draftGenerationSpec ? { draftGenerationSpec: node.draftGenerationSpec } : {}),
        diagnostics: node.diagnostics,
      },
    ];
  });
}

function dependencyDepths(dependencyMap: MediaGenerationDependencyMap): Map<string, number> {
  const depths = new Map<string, number>();
  const nodeIds = new Set(dependencyMap.nodes.map((node) => node.id));

  const depthFor = (nodeId: string, visiting: Set<string>): number => {
    const existing = depths.get(nodeId);
    if (existing !== undefined) {
      return existing;
    }
    if (visiting.has(nodeId)) {
      throw new ProjectDataError(
        'CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED',
        'Media generation dependency graph contains a cycle.'
      );
    }
    visiting.add(nodeId);
    const childDepths = dependencyMap.edges
      .filter((edge) => edge.toNodeId === nodeId && nodeIds.has(edge.fromNodeId))
      .map((edge) => depthFor(edge.fromNodeId, visiting));
    visiting.delete(nodeId);
    const depth = childDepths.length > 0 ? Math.max(...childDepths) + 1 : 0;
    depths.set(nodeId, depth);
    return depth;
  };

  dependencyMap.nodes.forEach((node) => depthFor(node.id, new Set()));
  return depths;
}

function planLineKind(node: MediaGenerationDependencyNode): MediaGenerationPlanLine['kind'] {
  if (node.kind === 'existing-asset') {
    return 'reused-asset';
  }
  if (node.kind === 'planned-generation') {
    return 'dependency-generation';
  }
  if (node.kind === 'external-input-required') {
    return 'required-attachment';
  }
  return node.mediaKind === 'video' ? 'final-video-generation' : 'final-generation';
}
