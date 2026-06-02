import type {
  SceneShot,
  ShotVideoTakeProductionGroup,
} from '@gorenku/studio-core/client';

/**
 * Pure grouping projection and cycling logic for the shot rail multi-shot
 * production groups (0041). This module owns adjacency, contiguous-range
 * detection, next-state cycling, group splitting, stable labels, and background
 * variant selection. It must not call React hooks, browser services, or fetch
 * APIs.
 */

export interface ShotGroupingEntry {
  shotId: string;
  index: number;
  /** App-derived label, e.g. `Shot 3`. */
  label: string;
  /** Production group id when this shot belongs to a durable group. */
  productionGroupId: string | null;
  /** Number of shots in the shot's group (1 when ungrouped). */
  groupSize: number;
  /** Restrained alternating background variant for adjacent groups. */
  variant: 0 | 1 | null;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}

export interface ShotGroupingProjection {
  entries: ShotGroupingEntry[];
  byShotId: Map<string, ShotGroupingEntry>;
}

interface ResolvedGroup {
  group: ShotVideoTakeProductionGroup;
  indexes: number[];
}

export function shotDisplayLabel(index: number): string {
  return `Shot ${index + 1}`;
}

function buildIndexByShotId(shots: SceneShot[]): Map<string, number> {
  const indexByShotId = new Map<string, number>();
  shots.forEach((shot, index) => indexByShotId.set(shot.shotId, index));
  return indexByShotId;
}

/** Resolve each production group to its sorted, contiguous shot indexes. */
function resolveGroups(
  shots: SceneShot[],
  groups: ShotVideoTakeProductionGroup[]
): ResolvedGroup[] {
  const indexByShotId = buildIndexByShotId(shots);
  return groups
    .map((group) => ({
      group,
      indexes: group.shotIds
        .map((shotId) => indexByShotId.get(shotId))
        .filter((index): index is number => index !== undefined)
        .sort((a, b) => a - b),
    }))
    .filter((resolved) => resolved.indexes.length > 0)
    .sort((a, b) => a.indexes[0] - b.indexes[0]);
}

export function buildShotGroupingProjection(
  shots: SceneShot[],
  groups: ShotVideoTakeProductionGroup[] | undefined
): ShotGroupingProjection {
  const resolved = resolveGroups(shots, groups ?? []);
  const groupByIndex = new Map<number, { resolved: ResolvedGroup; variant: 0 | 1 }>();
  resolved.forEach((entry, order) => {
    const variant: 0 | 1 = order % 2 === 0 ? 0 : 1;
    entry.indexes.forEach((index) => groupByIndex.set(index, { resolved: entry, variant }));
  });

  const entries = shots.map<ShotGroupingEntry>((shot, index) => {
    const owned = groupByIndex.get(index);
    if (!owned) {
      return {
        shotId: shot.shotId,
        index,
        label: shotDisplayLabel(index),
        productionGroupId: null,
        groupSize: 1,
        variant: null,
        isGroupStart: false,
        isGroupEnd: false,
      };
    }
    const indexes = owned.resolved.indexes;
    return {
      shotId: shot.shotId,
      index,
      label: shotDisplayLabel(index),
      productionGroupId: owned.resolved.group.productionGroupId,
      groupSize: indexes.length,
      variant: owned.variant,
      isGroupStart: index === indexes[0],
      isGroupEnd: index === indexes[indexes.length - 1],
    };
  });

  return {
    entries,
    byShotId: new Map(entries.map((entry) => [entry.shotId, entry])),
  };
}

/** The durable production group a shot belongs to, if any. */
export function findGroupForShot(
  groups: ShotVideoTakeProductionGroup[] | undefined,
  shotId: string
): ShotVideoTakeProductionGroup | null {
  return (
    (groups ?? []).find((group) => group.shotIds.includes(shotId)) ?? null
  );
}

/** Meaningful shot labels for a group, e.g. `['Shot 3', 'Shot 4']`. */
export function groupShotLabels(
  shots: SceneShot[],
  group: ShotVideoTakeProductionGroup
): string[] {
  const indexByShotId = buildIndexByShotId(shots);
  return group.shotIds
    .map((shotId) => indexByShotId.get(shotId))
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => a - b)
    .map((index) => shotDisplayLabel(index));
}

/** Quiet tab-bar tag copy, e.g. `Shot 3-4`, or `null` for single shots. */
export function groupTagLabel(
  shots: SceneShot[],
  group: ShotVideoTakeProductionGroup | null
): string | null {
  if (!group || group.shotIds.length < 2) {
    return null;
  }
  const indexByShotId = buildIndexByShotId(shots);
  const numbers = group.shotIds
    .map((shotId) => indexByShotId.get(shotId))
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => a - b)
    .map((index) => index + 1);
  if (numbers.length === 0) {
    return null;
  }
  return `Shot ${numbers[0]}-${numbers[numbers.length - 1]}`;
}

export function isMultiShotGroup(
  group: ShotVideoTakeProductionGroup | null
): boolean {
  return Boolean(group && group.shotIds.length > 1);
}

interface CycleOptions {
  createGroupId?: () => string;
}

function defaultGroupId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `scene_shot_video_take_group_${random}`;
}

/**
 * Compute the next set of production groups after clicking the group button on
 * one shot. The cycle always yields contiguous, non-overlapping groups and
 * never merges two adjacent groups in a single click.
 */
export function cycleShotGroupMembership(
  shots: SceneShot[],
  groups: ShotVideoTakeProductionGroup[] | undefined,
  shotId: string,
  options: CycleOptions = {}
): ShotVideoTakeProductionGroup[] {
  const createGroupId = options.createGroupId ?? defaultGroupId;
  const indexByShotId = buildIndexByShotId(shots);
  const target = indexByShotId.get(shotId);
  if (target === undefined) {
    return [...(groups ?? [])];
  }

  // Working membership: index -> production group id (or null).
  const membership = new Map<number, string | null>();
  shots.forEach((_, index) => membership.set(index, null));
  const groupsById = new Map<string, ShotVideoTakeProductionGroup>();
  (groups ?? []).forEach((group) => {
    groupsById.set(group.productionGroupId, group);
    group.shotIds.forEach((memberShotId) => {
      const index = indexByShotId.get(memberShotId);
      if (index !== undefined) {
        membership.set(index, group.productionGroupId);
      }
    });
  });

  const groupOf = (index: number): string | null =>
    index < 0 || index >= shots.length ? null : (membership.get(index) ?? null);
  const memberIndexes = (groupId: string): number[] =>
    shots
      .map((_, index) => index)
      .filter((index) => membership.get(index) === groupId);

  const current = groupOf(target);
  const above = groupOf(target - 1);
  const below = groupOf(target + 1);

  if (current === null) {
    // Ungrouped shot.
    if (above && below) {
      membership.set(target, above); // between two groups → join the upper
    } else if (above) {
      membership.set(target, above);
    } else if (below) {
      membership.set(target, below);
    } else {
      membership.set(target, createGroupId());
    }
  } else {
    const indexes = memberIndexes(current);
    const isSingle = indexes.length === 1;
    const isInterior =
      indexes[0] < target && target < indexes[indexes.length - 1];
    if (isInterior) {
      // Split the group: keep the upper half, move the lower half to a new
      // group, and leave the clicked shot ungrouped.
      const newGroupId = createGroupId();
      indexes
        .filter((index) => index > target)
        .forEach((index) => membership.set(index, newGroupId));
      membership.set(target, null);
    } else if (isSingle) {
      membership.set(target, null); // single group → ungroup
    } else if (target === indexes[0]) {
      // Top edge of a multi-shot group.
      if (above) {
        membership.set(target, null); // came from the lower group → ungroup
      } else {
        membership.set(target, createGroupId()); // pull into its own group
      }
    } else {
      // Bottom edge of a multi-shot group.
      if (below) {
        membership.set(target, below); // move down into the adjacent group
      } else {
        membership.set(target, createGroupId()); // pull into its own group
      }
    }
  }

  return rebuildGroups(shots, membership, groupsById);
}

function rebuildGroups(
  shots: SceneShot[],
  membership: Map<number, string | null>,
  groupsById: Map<string, ShotVideoTakeProductionGroup>
): ShotVideoTakeProductionGroup[] {
  const shotIdsByGroup = new Map<string, string[]>();
  shots.forEach((shot, index) => {
    const groupId = membership.get(index) ?? null;
    if (!groupId) {
      return;
    }
    const existing = shotIdsByGroup.get(groupId) ?? [];
    existing.push(shot.shotId);
    shotIdsByGroup.set(groupId, existing);
  });

  const result: ShotVideoTakeProductionGroup[] = [];
  shotIdsByGroup.forEach((shotIds, productionGroupId) => {
    const existing = groupsById.get(productionGroupId);
    result.push({
      productionGroupId,
      shotIds,
      videoTakeProduction: existing?.videoTakeProduction ?? {},
    });
  });
  return result;
}
