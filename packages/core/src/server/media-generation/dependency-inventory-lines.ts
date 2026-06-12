import type {
  MediaGenerationDependencyInventory,
  MediaGenerationDependencyInventoryEstimate,
  MediaGenerationDependencyLine,
  MediaGenerationPlanLine,
  MediaGenerationRootGenerationLine,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function aggregateDependencyInventoryEstimate(input: {
  dependencies: MediaGenerationDependencyLine[];
  rootGeneration: MediaGenerationRootGenerationLine;
}): MediaGenerationDependencyInventoryEstimate {
  const pricedLines = [
    ...input.dependencies.map((line) => line.pricing),
    input.rootGeneration.pricing,
  ].filter(
    (pricing): pricing is { state: 'priced'; estimatedUsd: number } =>
      pricing.state === 'priced'
  );
  const unpricedLines = [
    ...input.dependencies.map((line) => line.pricing),
    input.rootGeneration.pricing,
  ].filter((pricing) => pricing.state === 'unpriced');
  const unavailableDependencies = input.dependencies.filter(
    (line) =>
      line.required &&
      (line.availability.state === 'missing-manual' ||
        line.availability.state === 'invalid-selection')
  );
  const total = pricedLines.reduce((sum, pricing) => sum + pricing.estimatedUsd, 0);
  return {
    state:
      unavailableDependencies.length > 0
        ? 'unavailable'
        : unpricedLines.length > 0
          ? 'partial'
          : 'complete',
    estimatedTotalUsd: unavailableDependencies.length > 0 ? null : total,
    pricedDependencyCount: pricedLines.length,
    unpricedDependencyCount: unpricedLines.length,
    unavailableDependencyCount: unavailableDependencies.length,
    requiresPriceOverride: unpricedLines.length > 0,
  };
}

export function planLinesFromDependencyInventory(
  inventory: MediaGenerationDependencyInventory
): MediaGenerationPlanLine[] {
  return [
    ...inventory.dependencies.map((line) => dependencyPlanLine(line)),
    rootPlanLine(inventory.rootGeneration),
  ];
}

function dependencyPlanLine(
  line: MediaGenerationDependencyLine
): MediaGenerationPlanLine {
  return {
    id: `line:${line.id}`,
    dependencyLineId: line.id,
    kind: planLineKind(line),
    label: line.label,
    purpose: line.purpose,
    mediaKind: line.mediaKind,
    dependencyId: line.dependencyId,
    dependencyKind: line.dependencyKind,
    depth: 0,
    state: dependencyLineState(line),
    materializationState: dependencyLineMaterializationState(line),
    pricing: line.pricing,
    required: line.required,
    ...(line.selectedAsset ? { sourceAssetId: line.selectedAsset.assetId } : {}),
    ...(line.generationDraft.state === 'authored'
      ? { draftGenerationSpec: line.generationDraft.draftGenerationSpec }
      : {}),
    diagnostics: line.diagnostics,
  };
}

function rootPlanLine(
  line: MediaGenerationRootGenerationLine
): MediaGenerationPlanLine {
  return {
    id: `line:${line.id}`,
    dependencyLineId: line.id,
    kind: line.mediaKind === 'video' ? 'final-video-generation' : 'final-generation',
    label: line.label,
    purpose: line.purpose,
    mediaKind: line.mediaKind,
    depth: 0,
    state: line.pricing.state === 'not-applicable' ? 'missing' : 'planned',
    materializationState: line.canCreateSpec ? 'generatable' : 'blocked-by-dependencies',
    ...(line.blockedReason ? { materializationReason: line.blockedReason } : {}),
    pricing: line.pricing,
    required: true,
    diagnostics: line.diagnostics,
  };
}

function planLineKind(
  line: MediaGenerationDependencyLine
): MediaGenerationPlanLine['kind'] {
  if (line.availability.state === 'satisfied') {
    return 'reused-asset';
  }
  if (line.availability.state === 'missing-generated') {
    return 'dependency-generation';
  }
  return 'required-attachment';
}

function dependencyLineState(
  line: MediaGenerationDependencyLine
): MediaGenerationPlanLine['state'] {
  if (line.availability.state === 'satisfied') {
    return 'ready';
  }
  if (line.availability.state === 'missing-generated') {
    return 'planned';
  }
  return 'missing';
}

function dependencyLineMaterializationState(
  line: MediaGenerationDependencyLine
): MediaGenerationPlanLine['materializationState'] {
  if (line.availability.state === 'satisfied') {
    return 'materialized';
  }
  if (line.availability.state === 'missing-manual') {
    return 'requires-external-input';
  }
  if (line.availability.state === 'invalid-selection') {
    return 'invalid-generation-draft';
  }
  if (line.generationDraft.state === 'authored') {
    return 'generatable';
  }
  if (line.generationDraft.state === 'estimate-only') {
    return 'needs-authored-draft';
  }
  if (line.generationDraft.state === 'blocked') {
    return 'invalid-generation-draft';
  }
  throw new ProjectDataError(
    'CORE_MEDIA_DEPENDENCY_INVALID_INVENTORY_LINE',
    `Generated dependency line has no draft state: ${line.id}.`
  );
}
