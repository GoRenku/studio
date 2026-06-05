import type {
  SceneShot,
  ShotVideoTakeRailGroup,
} from '@gorenku/studio-core/client';

/**
 * Pure shot-rail grouping projection and draft cycling logic. This module owns
 * local edit semantics only; persistence belongs to the Studio service/API
 * layer and core owns final validation.
 */

export interface ShotGroupingEntry {
  shotId: string;
  index: number;
  label: string;
  productionGroupId: string | null;
  groupSize: number;
  variant: 0 | 1 | null;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}

export interface ShotGroupingProjection {
  entries: ShotGroupingEntry[];
  byShotId: Map<string, ShotGroupingEntry>;
}

export interface ShotRailGroupDraft {
  draftGroupId: string;
  productionGroupId?: string;
  sourceProductionGroupId?: string;
  mergePartnerProductionGroupId?: string;
  mergePartnerDraft?: ShotRailGroupDraft;
  mergePivotShotId?: string;
  shotIds: string[];
}

export interface ShotRailGroupChangeSummary {
  messages: string[];
  changedPromptCount: number;
}

export interface ShotRailGroupSaveInput {
  productionGroupId?: string;
  sourceProductionGroupId?: string;
  mergePartnerProductionGroupId?: string;
  shotIds: string[];
}

type VisibleShotRailGroup = ShotVideoTakeRailGroup | ShotRailGroupDraft;

interface ResolvedGroup {
  group: VisibleShotRailGroup;
  groupId: string;
  indexes: number[];
}

export function shotDisplayLabel(index: number): string {
  return `Shot ${index + 1}`;
}

export function createShotRailGroupDraftsFromRailGroups(
  railGroups: ShotVideoTakeRailGroup[] | undefined
): ShotRailGroupDraft[] {
  return (railGroups ?? []).map((group) => ({
    draftGroupId: group.productionGroupId,
    productionGroupId: group.productionGroupId,
    shotIds: [...group.shotIds],
  }));
}

export function createDefaultShotRailDraftGroupId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `shot_rail_group_draft_${random}`;
}

export function buildShotGroupingProjection(
  shots: SceneShot[],
  groups: VisibleShotRailGroup[] | undefined
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
      productionGroupId: owned.resolved.groupId,
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

export function cycleShotRailGroupMembership(input: {
  shots: SceneShot[];
  draftGroups: ShotRailGroupDraft[];
  clickedShotId: string;
  createDraftGroupId?: () => string;
}): ShotRailGroupDraft[] {
  const createDraftGroupId =
    input.createDraftGroupId ?? createDefaultShotRailDraftGroupId;
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

export function findRailGroupForShot<T extends { shotIds: string[] }>(
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

export function shotRailDraftsEqual(
  left: ShotRailGroupDraft[],
  right: ShotRailGroupDraft[]
): boolean {
  const normalizedLeft = comparableDraftGroups(left);
  const normalizedRight = comparableDraftGroups(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((group, index) => {
      const other = normalizedRight[index];
      return (
        other &&
        group.productionGroupId === other.productionGroupId &&
        group.shotIds === other.shotIds
      );
    })
  );
}

export function shotRailGroupsForSave(
  draftGroups: ShotRailGroupDraft[]
): ShotRailGroupSaveInput[] {
  return draftGroups.map((group) => ({
    ...(group.productionGroupId
      ? { productionGroupId: group.productionGroupId }
      : {}),
    ...(group.sourceProductionGroupId
      ? { sourceProductionGroupId: group.sourceProductionGroupId }
      : {}),
    ...(group.mergePartnerProductionGroupId
      ? { mergePartnerProductionGroupId: group.mergePartnerProductionGroupId }
      : {}),
    shotIds: [...group.shotIds],
  }));
}

export function summarizeShotRailGroupChanges(input: {
  shots: SceneShot[];
  persistedDraftGroups: ShotRailGroupDraft[];
  draftGroups: ShotRailGroupDraft[];
}): ShotRailGroupChangeSummary {
  if (shotRailDraftsEqual(input.persistedDraftGroups, input.draftGroups)) {
    return { messages: ['No grouping changes to apply.'], changedPromptCount: 0 };
  }
  const persistedById = new Map(
    input.persistedDraftGroups
      .filter((group) => group.productionGroupId)
      .map((group) => [group.productionGroupId as string, group])
  );
  const draftById = new Map(
    input.draftGroups
      .filter((group) => group.productionGroupId)
      .map((group) => [group.productionGroupId as string, group])
  );
  const messages: string[] = [];
  const changedPromptGroupIds = new Set<string>();

  input.draftGroups.forEach((group) => {
    const groupId = group.productionGroupId ?? group.draftGroupId;
    if (group.mergePartnerProductionGroupId) {
      messages.push(`Merge into ${groupRangeLabel(input.shots, group)}.`);
      changedPromptGroupIds.add(groupId);
      return;
    }
    const persisted = group.productionGroupId
      ? persistedById.get(group.productionGroupId)
      : undefined;
    if (!persisted) {
      messages.push(
        `Create ${groupRangeLabel(input.shots, group)}${
          group.sourceProductionGroupId ? ' from split settings' : ''
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
    if (group.productionGroupId && draftById.has(group.productionGroupId)) {
      return;
    }
    const mergedInto = input.draftGroups.some(
      (draftGroup) =>
        draftGroup.mergePartnerProductionGroupId === group.productionGroupId
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
  groups: VisibleShotRailGroup[]
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
  groups: ShotRailGroupDraft[],
  index: number
): ShotRailGroupDraft | null {
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
  groups: ShotRailGroupDraft[],
  group: ShotRailGroupDraft,
  shotId: string
): ShotRailGroupDraft[] {
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
  group: ShotRailGroupDraft,
  shotId: string
): ShotRailGroupDraft {
  return {
    ...clearMergeState(group),
    shotIds: orderShotIds(shots, [...group.shotIds, shotId]),
  };
}

function removeDraftGroup(
  groups: ShotRailGroupDraft[],
  group: ShotRailGroupDraft
): ShotRailGroupDraft[] {
  return groups.filter(
    (candidate) => candidate.draftGroupId !== group.draftGroupId
  );
}

function shrinkDraftGroup(
  shots: SceneShot[],
  group: ShotRailGroupDraft,
  shotId: string
): ShotRailGroupDraft | null {
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
  draftGroups: ShotRailGroupDraft[];
  group: ShotRailGroupDraft;
  clickedShotId: string;
  createDraftGroupId: () => string;
}): ShotRailGroupDraft[] {
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
  const sourceProductionGroupId =
    input.group.productionGroupId ?? input.group.sourceProductionGroupId;
  const replacementGroups: ShotRailGroupDraft[] = [
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
            ...(sourceProductionGroupId ? { sourceProductionGroupId } : {}),
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
  draftGroups: ShotRailGroupDraft[];
  upperGroup: ShotRailGroupDraft;
  lowerGroup: ShotRailGroupDraft;
  pivotShotId: string;
}): ShotRailGroupDraft[] {
  const mergePartnerProductionGroupId =
    input.lowerGroup.productionGroupId ?? input.lowerGroup.sourceProductionGroupId;
  const mergedGroup: ShotRailGroupDraft = {
    ...clearMergeState(input.upperGroup),
    shotIds: orderShotIds(input.shots, [
      ...input.upperGroup.shotIds,
      ...input.lowerGroup.shotIds,
    ]),
    ...(mergePartnerProductionGroupId ? { mergePartnerProductionGroupId } : {}),
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
  groups: ShotRailGroupDraft[],
  mergedGroup: ShotRailGroupDraft,
  pivotShotId: string
): ShotRailGroupDraft[] {
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
  const replacementGroups: ShotRailGroupDraft[] = [
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
  groups: ShotRailGroupDraft[]
): ShotRailGroupDraft[] {
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

function clearMergeState(group: ShotRailGroupDraft): ShotRailGroupDraft {
  const nextGroup: ShotRailGroupDraft = { ...group };
  delete nextGroup.mergePartnerProductionGroupId;
  delete nextGroup.mergePartnerDraft;
  delete nextGroup.mergePivotShotId;
  return nextGroup;
}

function comparableDraftGroups(groups: ShotRailGroupDraft[]) {
  return groups
    .map((group) => ({
      productionGroupId: group.productionGroupId ?? null,
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

function visibleGroupId(group: VisibleShotRailGroup): string {
  return 'draftGroupId' in group ? group.draftGroupId : group.productionGroupId;
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
