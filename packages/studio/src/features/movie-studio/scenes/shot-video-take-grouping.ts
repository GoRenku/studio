import type {
  SceneShot,
} from '@gorenku/studio-core/client';

/**
 * Pure shot-rail grouping projection and draft cycling logic. This module owns
 * local edit semantics only; persistence belongs to the Studio service/API
 * layer and Core owns final validation.
 */

export interface ShotGroupingEntry {
  shotId: string;
  index: number;
  label: string;
  takeId: string | null;
  groupSize: number;
  variant: 0 | 1 | null;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}

export interface ShotGroupingProjection {
  entries: ShotGroupingEntry[];
  byShotId: Map<string, ShotGroupingEntry>;
}

export interface TakeScopedShotGroupDraft {
  draftGroupId: string;
  takeId?: string;
  sourceTakeId?: string;
  mergePartnerTakeId?: string;
  mergePartnerDraft?: TakeScopedShotGroupDraft;
  mergePivotShotId?: string;
  shotIds: string[];
}

export interface ShotRailGroupChangeSummary {
  messages: string[];
  changedPromptCount: number;
}

export interface TakeScopedShotGroupSaveInput {
  takeId?: string;
  sourceTakeId?: string;
  mergePartnerTakeId?: string;
  shotIds: string[];
}

type VisibleTakeScopedShotGroup = {
  takeId: string;
  shotIds: string[];
} | TakeScopedShotGroupDraft;

interface ResolvedGroup {
  group: VisibleTakeScopedShotGroup;
  groupId: string;
  indexes: number[];
}

export function shotDisplayLabel(index: number): string {
  return `Shot ${index + 1}`;
}

export function createShotGroupDraftsFromTakes(
  takes: { takeId: string; shotIds: string[] }[] | undefined
): TakeScopedShotGroupDraft[] {
  return (takes ?? []).map((take) => ({
    draftGroupId: take.takeId,
    takeId: take.takeId,
    shotIds: [...take.shotIds],
  }));
}

export function createDefaultShotGroupDraftId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `shot_group_draft_${random}`;
}

export function buildShotGroupingProjection(
  shots: SceneShot[],
  groups: VisibleTakeScopedShotGroup[] | undefined
): ShotGroupingProjection {
  const resolved = resolveGroups(shots, groups ?? []);
  const groupByIndex = new Map<
    number,
    { resolved: ResolvedGroup; variant: 0 | 1 }
  >();
  resolved.forEach((entry, order) => {
    const variant: 0 | 1 = order % 2 === 0 ? 0 : 1;
    entry.indexes.forEach((index) =>
      groupByIndex.set(index, { resolved: entry, variant })
    );
  });

  const entries = shots.map<ShotGroupingEntry>((shot, index) => {
    const owned = groupByIndex.get(index);
    if (!owned) {
      return {
        shotId: shot.shotId,
        index,
        label: shotDisplayLabel(index),
        takeId: null,
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
      takeId: owned.resolved.groupId,
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

export function cycleShotGroupMembership(input: {
  shots: SceneShot[];
  draftGroups: TakeScopedShotGroupDraft[];
  clickedShotId: string;
  createDraftGroupId?: () => string;
}): TakeScopedShotGroupDraft[] {
  const createDraftGroupId =
    input.createDraftGroupId ?? createDefaultShotGroupDraftId;
  const draftGroups = normalizeDraftGroups(input.shots, input.draftGroups);
  const indexByShotId = buildIndexByShotId(input.shots);
  const targetIndex = indexByShotId.get(input.clickedShotId);
  if (targetIndex === undefined) {
    return draftGroups;
  }

  const current = draftGroupAtIndex(input.shots, draftGroups, targetIndex);
  const above = draftGroupAtIndex(input.shots, draftGroups, targetIndex - 1);
  const below = draftGroupAtIndex(input.shots, draftGroups, targetIndex + 1);

  if (!current) {
    if (above) {
      return addShotToDraftGroup(
        input.shots,
        draftGroups,
        above,
        input.clickedShotId
      );
    }
    if (below) {
      return addShotToDraftGroup(
        input.shots,
        draftGroups,
        below,
        input.clickedShotId
      );
    }
    return normalizeDraftGroups(input.shots, [
      ...draftGroups,
      {
        draftGroupId: createDraftGroupId(),
        shotIds: [input.clickedShotId],
      },
    ]);
  }

  const indexes = current.shotIds
    .map((shotId) => indexByShotId.get(shotId))
    .filter((index): index is number => index !== undefined)
    .sort((left, right) => left - right);
  if (indexes.length === 1) {
    return removeDraftGroup(draftGroups, current);
  }

  const isInterior =
    indexes[0] < targetIndex && targetIndex < indexes[indexes.length - 1];
  if (isInterior) {
    if (
      current.mergePartnerDraft &&
      current.mergePivotShotId === input.clickedShotId
    ) {
      return restoreGapFromMergedDraftGroup(
        input.shots,
        draftGroups,
        current,
        input.clickedShotId
      );
    }
    return splitDraftGroupAtShot({
      shots: input.shots,
      draftGroups,
      group: current,
      clickedShotId: input.clickedShotId,
      createDraftGroupId,
    });
  }

  const isTopEdge = targetIndex === indexes[0];
  if (isTopEdge && above && above.draftGroupId !== current.draftGroupId) {
    return mergeAdjacentDraftGroups({
      shots: input.shots,
      draftGroups,
      upperGroup: above,
      lowerGroup: current,
      pivotShotId: input.clickedShotId,
    });
  }

  const isBottomEdge = targetIndex === indexes[indexes.length - 1];
  if (isBottomEdge && below && below.draftGroupId !== current.draftGroupId) {
    const withoutTarget = shrinkDraftGroup(
      input.shots,
      current,
      input.clickedShotId
    );
    return normalizeDraftGroups(
      input.shots,
      draftGroups.flatMap((group) => {
        if (group.draftGroupId === current.draftGroupId) {
          return withoutTarget ? [withoutTarget] : [];
        }
        if (group.draftGroupId === below.draftGroupId) {
          return [
            addShotToGroupDraft(input.shots, group, input.clickedShotId),
          ];
        }
        return [group];
      })
    );
  }

  const withoutTarget = shrinkDraftGroup(
    input.shots,
    current,
    input.clickedShotId
  );
  return normalizeDraftGroups(
    input.shots,
    draftGroups.flatMap((group) => {
      if (group.draftGroupId !== current.draftGroupId) {
        return [group];
      }
      return withoutTarget ? [withoutTarget] : [];
    })
  );
}

export function findShotGroupForShot<T extends { shotIds: string[] }>(
  groups: T[] | undefined,
  shotId: string
): T | null {
  return (
    (groups ?? []).find((group) => group.shotIds.includes(shotId)) ?? null
  );
}

export function groupShotLabels(
  shots: SceneShot[],
  group: { shotIds: string[] }
): string[] {
  const indexByShotId = buildIndexByShotId(shots);
  return group.shotIds
    .map((shotId) => indexByShotId.get(shotId))
    .filter((index): index is number => index !== undefined)
    .sort((left, right) => left - right)
    .map((index) => shotDisplayLabel(index));
}

export function groupTagLabel(
  shots: SceneShot[],
  group: { shotIds: string[] } | null
): string | null {
  if (!group || group.shotIds.length === 0) {
    return null;
  }
  const numbers = groupShotLabels(shots, group).map((label) =>
    Number(label.replace('Shot ', ''))
  );
  if (numbers.length === 1) {
    return `Shot ${numbers[0]}`;
  }
  return `Shot ${numbers[0]}-${numbers[numbers.length - 1]}`;
}

export function isMultiShotGroup(group: { shotIds: string[] } | null): boolean {
  return Boolean(group && group.shotIds.length > 1);
}

export function shotGroupDraftsEqual(
  left: TakeScopedShotGroupDraft[],
  right: TakeScopedShotGroupDraft[]
): boolean {
  const normalizedLeft = comparableDraftGroups(left);
  const normalizedRight = comparableDraftGroups(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((group, index) => {
      const other = normalizedRight[index];
      return (
        other &&
        group.takeId === other.takeId &&
        group.shotIds === other.shotIds
      );
    })
  );
}

export function shotGroupsForSave(
  draftGroups: TakeScopedShotGroupDraft[]
): TakeScopedShotGroupSaveInput[] {
  return draftGroups.map((group) => ({
    ...(group.takeId
      ? { takeId: group.takeId }
      : {}),
    ...(group.sourceTakeId
      ? { sourceTakeId: group.sourceTakeId }
      : {}),
    ...(group.mergePartnerTakeId
      ? { mergePartnerTakeId: group.mergePartnerTakeId }
      : {}),
    shotIds: [...group.shotIds],
  }));
}

export function summarizeShotGroupChanges(input: {
  shots: SceneShot[];
  persistedDraftGroups: TakeScopedShotGroupDraft[];
  draftGroups: TakeScopedShotGroupDraft[];
}): ShotRailGroupChangeSummary {
  if (shotGroupDraftsEqual(input.persistedDraftGroups, input.draftGroups)) {
    return { messages: ['No grouping changes to apply.'], changedPromptCount: 0 };
  }
  const persistedById = new Map(
    input.persistedDraftGroups
      .filter((group) => group.takeId)
      .map((group) => [group.takeId as string, group])
  );
  const draftById = new Map(
    input.draftGroups
      .filter((group) => group.takeId)
      .map((group) => [group.takeId as string, group])
  );
  const messages: string[] = [];
  const changedPromptGroupIds = new Set<string>();

  input.draftGroups.forEach((group) => {
    const groupId = group.takeId ?? group.draftGroupId;
    if (group.mergePartnerTakeId) {
      messages.push(`Merge into ${groupRangeLabel(input.shots, group)}.`);
      changedPromptGroupIds.add(groupId);
      return;
    }
    const persisted = group.takeId
      ? persistedById.get(group.takeId)
      : undefined;
    if (!persisted) {
      messages.push(
        `Create ${groupRangeLabel(input.shots, group)}${
          group.sourceTakeId ? ' from split settings' : ''
        }.`
      );
      changedPromptGroupIds.add(groupId);
      return;
    }
    if (!sameShotIds(persisted.shotIds, group.shotIds)) {
      messages.push(
        `${group.shotIds.length > persisted.shotIds.length ? 'Expand' : 'Change'} ${groupRangeLabel(input.shots, persisted)} to ${groupRangeLabel(input.shots, group)}.`
      );
      changedPromptGroupIds.add(groupId);
    }
  });

  input.persistedDraftGroups.forEach((group) => {
    if (group.takeId && draftById.has(group.takeId)) {
      return;
    }
    const mergedInto = input.draftGroups.some(
      (draftGroup) =>
        draftGroup.mergePartnerTakeId === group.takeId
    );
    if (mergedInto) {
      return;
    }
    messages.push(`Clear ${groupRangeLabel(input.shots, group)} from the rail.`);
  });

  return { messages, changedPromptCount: changedPromptGroupIds.size };
}

function resolveGroups(
  shots: SceneShot[],
  groups: VisibleTakeScopedShotGroup[]
): ResolvedGroup[] {
  const indexByShotId = buildIndexByShotId(shots);
  return groups
    .map((group) => ({
      group,
      groupId: visibleGroupId(group),
      indexes: group.shotIds
        .map((shotId) => indexByShotId.get(shotId))
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => left - right),
    }))
    .filter((resolved) => resolved.indexes.length > 0)
    .sort((left, right) => left.indexes[0] - right.indexes[0]);
}

function draftGroupAtIndex(
  shots: SceneShot[],
  groups: TakeScopedShotGroupDraft[],
  index: number
): TakeScopedShotGroupDraft | null {
  if (index < 0 || index >= shots.length) {
    return null;
  }
  const shotId = shots[index]?.shotId;
  if (!shotId) {
    return null;
  }
  return groups.find((group) => group.shotIds.includes(shotId)) ?? null;
}

function addShotToDraftGroup(
  shots: SceneShot[],
  groups: TakeScopedShotGroupDraft[],
  group: TakeScopedShotGroupDraft,
  shotId: string
): TakeScopedShotGroupDraft[] {
  return normalizeDraftGroups(
    shots,
    groups.map((candidate) =>
      candidate.draftGroupId === group.draftGroupId
        ? addShotToGroupDraft(shots, candidate, shotId)
        : candidate
    )
  );
}

function addShotToGroupDraft(
  shots: SceneShot[],
  group: TakeScopedShotGroupDraft,
  shotId: string
): TakeScopedShotGroupDraft {
  return {
    ...clearMergeState(group),
    shotIds: orderShotIds(shots, [...group.shotIds, shotId]),
  };
}

function removeDraftGroup(
  groups: TakeScopedShotGroupDraft[],
  group: TakeScopedShotGroupDraft
): TakeScopedShotGroupDraft[] {
  return groups.filter(
    (candidate) => candidate.draftGroupId !== group.draftGroupId
  );
}

function shrinkDraftGroup(
  shots: SceneShot[],
  group: TakeScopedShotGroupDraft,
  shotId: string
): TakeScopedShotGroupDraft | null {
  const shotIds = orderShotIds(
    shots,
    group.shotIds.filter((memberShotId) => memberShotId !== shotId)
  );
  return shotIds.length > 0
    ? { ...clearMergeState(group), shotIds }
    : null;
}

function splitDraftGroupAtShot(input: {
  shots: SceneShot[];
  draftGroups: TakeScopedShotGroupDraft[];
  group: TakeScopedShotGroupDraft;
  clickedShotId: string;
  createDraftGroupId: () => string;
}): TakeScopedShotGroupDraft[] {
  const indexByShotId = buildIndexByShotId(input.shots);
  const targetIndex = indexByShotId.get(input.clickedShotId);
  if (targetIndex === undefined) {
    return input.draftGroups;
  }
  const upperShotIds = input.group.shotIds.filter((shotId) => {
    const index = indexByShotId.get(shotId);
    return index !== undefined && index < targetIndex;
  });
  const lowerShotIds = input.group.shotIds.filter((shotId) => {
    const index = indexByShotId.get(shotId);
    return index !== undefined && index > targetIndex;
  });
  const sourceTakeId =
    input.group.takeId ?? input.group.sourceTakeId;
  const replacementGroups: TakeScopedShotGroupDraft[] = [
    ...(upperShotIds.length > 0
      ? [
          {
            ...clearMergeState(input.group),
            shotIds: orderShotIds(input.shots, upperShotIds),
          },
        ]
      : []),
    ...(lowerShotIds.length > 0
      ? [
          {
            draftGroupId: input.createDraftGroupId(),
            ...(sourceTakeId ? { sourceTakeId } : {}),
            shotIds: orderShotIds(input.shots, lowerShotIds),
          },
        ]
      : []),
  ];
  return normalizeDraftGroups(
    input.shots,
    input.draftGroups.flatMap((group) =>
      group.draftGroupId === input.group.draftGroupId
        ? replacementGroups
        : [group]
    )
  );
}

function mergeAdjacentDraftGroups(input: {
  shots: SceneShot[];
  draftGroups: TakeScopedShotGroupDraft[];
  upperGroup: TakeScopedShotGroupDraft;
  lowerGroup: TakeScopedShotGroupDraft;
  pivotShotId: string;
}): TakeScopedShotGroupDraft[] {
  const mergePartnerTakeId =
    input.lowerGroup.takeId ?? input.lowerGroup.sourceTakeId;
  const mergedGroup: TakeScopedShotGroupDraft = {
    ...clearMergeState(input.upperGroup),
    shotIds: orderShotIds(input.shots, [
      ...input.upperGroup.shotIds,
      ...input.lowerGroup.shotIds,
    ]),
    ...(mergePartnerTakeId ? { mergePartnerTakeId } : {}),
    mergePartnerDraft: input.lowerGroup,
    mergePivotShotId: input.pivotShotId,
  };
  return normalizeDraftGroups(
    input.shots,
    input.draftGroups.flatMap((group) => {
      if (group.draftGroupId === input.upperGroup.draftGroupId) {
        return [mergedGroup];
      }
      if (group.draftGroupId === input.lowerGroup.draftGroupId) {
        return [];
      }
      return [group];
    })
  );
}

function restoreGapFromMergedDraftGroup(
  shots: SceneShot[],
  groups: TakeScopedShotGroupDraft[],
  mergedGroup: TakeScopedShotGroupDraft,
  pivotShotId: string
): TakeScopedShotGroupDraft[] {
  const partner = mergedGroup.mergePartnerDraft;
  if (!partner) {
    return groups;
  }
  const partnerShotIds = partner.shotIds.filter(
    (shotId) => shotId !== pivotShotId
  );
  const partnerShotSet = new Set(partner.shotIds);
  const upperShotIds = mergedGroup.shotIds.filter(
    (shotId) => !partnerShotSet.has(shotId)
  );
  const replacementGroups: TakeScopedShotGroupDraft[] = [
    ...(upperShotIds.length > 0
      ? [
          {
            ...clearMergeState(mergedGroup),
            shotIds: orderShotIds(shots, upperShotIds),
          },
        ]
      : []),
    ...(partnerShotIds.length > 0
      ? [
          {
            ...clearMergeState(partner),
            shotIds: orderShotIds(shots, partnerShotIds),
          },
        ]
      : []),
  ];
  return normalizeDraftGroups(
    shots,
    groups.flatMap((group) =>
      group.draftGroupId === mergedGroup.draftGroupId
        ? replacementGroups
        : [group]
    )
  );
}

function normalizeDraftGroups(
  shots: SceneShot[],
  groups: TakeScopedShotGroupDraft[]
): TakeScopedShotGroupDraft[] {
  return groups
    .map((group) => ({
      ...group,
      shotIds: orderShotIds(shots, group.shotIds),
    }))
    .filter((group) => group.shotIds.length > 0)
    .sort(
      (left, right) =>
        firstShotIndex(shots, left.shotIds) -
        firstShotIndex(shots, right.shotIds)
    );
}

function clearMergeState(
  group: TakeScopedShotGroupDraft
): TakeScopedShotGroupDraft {
  const nextGroup: TakeScopedShotGroupDraft = { ...group };
  delete nextGroup.mergePartnerTakeId;
  delete nextGroup.mergePartnerDraft;
  delete nextGroup.mergePivotShotId;
  return nextGroup;
}

function comparableDraftGroups(groups: TakeScopedShotGroupDraft[]) {
  return groups
    .map((group) => ({
      takeId: group.takeId ?? null,
      shotIds: group.shotIds.join(','),
    }))
    .sort((left, right) => left.shotIds.localeCompare(right.shotIds));
}

function groupRangeLabel(
  shots: SceneShot[],
  group: { shotIds: string[] }
): string {
  const labels = groupShotLabels(shots, group);
  if (labels.length === 0) {
    return 'group';
  }
  if (labels.length === 1) {
    return labels[0] ?? 'group';
  }
  return `${labels[0]}-${labels[labels.length - 1]?.replace('Shot ', '')}`;
}

function orderShotIds(shots: SceneShot[], shotIds: string[]): string[] {
  const requested = new Set(shotIds);
  return shots
    .filter((shot) => requested.has(shot.shotId))
    .map((shot) => shot.shotId);
}

function firstShotIndex(shots: SceneShot[], shotIds: string[]): number {
  const indexByShotId = buildIndexByShotId(shots);
  return indexByShotId.get(shotIds[0] ?? '') ?? Number.MAX_SAFE_INTEGER;
}

function visibleGroupId(group: VisibleTakeScopedShotGroup): string {
  return 'draftGroupId' in group ? group.draftGroupId : group.takeId;
}

function buildIndexByShotId(shots: SceneShot[]): Map<string, number> {
  return new Map(shots.map((shot, index) => [shot.shotId, index]));
}

function sameShotIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((shotId, index) => shotId === right[index])
  );
}
