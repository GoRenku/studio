import type {
  SceneShot,
} from '@gorenku/studio-core/client';

/**
 * Pure shot-rail selection projection and draft cycling logic. This module owns
 * local edit semantics only; persistence belongs to the Studio service/API
 * layer and Core owns final validation.
 */

export interface TakeShotSelectionEntry {
  shotId: string;
  index: number;
  label: string;
  takeId: string | null;
  selectionSize: number;
  variant: 0 | 1 | null;
  isSelectionStart: boolean;
  isSelectionEnd: boolean;
}

export interface TakeShotSelectionProjection {
  entries: TakeShotSelectionEntry[];
  byShotId: Map<string, TakeShotSelectionEntry>;
}

export interface TakeShotSelectionDraft {
  draftSelectionId: string;
  takeId?: string;
  shotIds: string[];
}

export interface TakeShotSelectionChangeSummary {
  messages: string[];
  changedPromptCount: number;
}

type VisibleTakeScopedShotSelection = {
  takeId: string;
  shotIds: string[];
} | TakeShotSelectionDraft;

interface ResolvedSelection {
  selectionId: string;
  indexes: number[];
}

export function shotDisplayLabel(index: number): string {
  return `Shot ${index + 1}`;
}

export function createTakeShotSelectionDraftsFromTakes(
  takes: { takeId: string; shotIds: string[] }[] | undefined
): TakeShotSelectionDraft[] {
  return (takes ?? []).map((take) => ({
    draftSelectionId: take.takeId,
    takeId: take.takeId,
    shotIds: [...take.shotIds],
  }));
}

export function createDefaultTakeShotSelectionDraftId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `shot_selection_draft_${random}`;
}

export function buildTakeShotSelectionProjection(
  shots: SceneShot[],
  selections: VisibleTakeScopedShotSelection[] | undefined
): TakeShotSelectionProjection {
  const resolved = resolveSelections(shots, selections ?? []);
  const selectionByIndex = new Map<
    number,
    { resolved: ResolvedSelection; variant: 0 | 1 }
  >();
  resolved.forEach((entry, order) => {
    const variant: 0 | 1 = order % 2 === 0 ? 0 : 1;
    entry.indexes.forEach((index) =>
      selectionByIndex.set(index, { resolved: entry, variant })
    );
  });

  const entries = shots.map<TakeShotSelectionEntry>((shot, index) => {
    const owned = selectionByIndex.get(index);
    if (!owned) {
      return {
        shotId: shot.shotId,
        index,
        label: shotDisplayLabel(index),
        takeId: null,
        selectionSize: 1,
        variant: null,
        isSelectionStart: false,
        isSelectionEnd: false,
      };
    }
    const indexes = owned.resolved.indexes;
    return {
      shotId: shot.shotId,
      index,
      label: shotDisplayLabel(index),
      takeId: owned.resolved.selectionId,
      selectionSize: indexes.length,
      variant: owned.variant,
      isSelectionStart: index === indexes[0],
      isSelectionEnd: index === indexes[indexes.length - 1],
    };
  });

  return {
    entries,
    byShotId: new Map(entries.map((entry) => [entry.shotId, entry])),
  };
}

export function cycleTakeShotSelection(input: {
  shots: SceneShot[];
  draftSelections: TakeShotSelectionDraft[];
  clickedShotId: string;
  createDraftSelectionId?: () => string;
}): TakeShotSelectionDraft[] {
  const indexByShotId = buildIndexByShotId(input.shots);
  const clickedIndex = indexByShotId.get(input.clickedShotId);
  if (clickedIndex === undefined) {
    return normalizeDraftSelections(input.shots, input.draftSelections);
  }

  const currentDraft = selectOpenTakeDraft({
    draftSelections: input.draftSelections,
    createDraftSelectionId:
      input.createDraftSelectionId ?? createDefaultTakeShotSelectionDraftId,
  });
  const currentIndexes = orderedSelectionIndexes(
    input.shots,
    currentDraft.shotIds
  );
  const clickedIsSelected = currentIndexes.includes(clickedIndex);

  if (clickedIsSelected) {
    return [
      {
        ...currentDraft,
        shotIds: removeSelectedShot({
          currentIndexes,
          clickedIndex,
          shots: input.shots,
        }),
      },
    ];
  }

  if (shouldExpandSelection(currentIndexes, clickedIndex)) {
    return [
      {
        ...currentDraft,
        shotIds: orderShotIds(input.shots, [
          ...currentDraft.shotIds,
          input.clickedShotId,
        ]),
      },
    ];
  }

  return [
    {
      ...currentDraft,
      shotIds: [input.clickedShotId],
    },
  ];
}

export function findTakeShotSelectionForShot<T extends { shotIds: string[] }>(
  selections: T[] | undefined,
  shotId: string
): T | null {
  return (
    (selections ?? []).find((selection) => selection.shotIds.includes(shotId)) ?? null
  );
}

export function takeShotSelectionLabels(
  shots: SceneShot[],
  selection: { shotIds: string[] }
): string[] {
  const indexByShotId = buildIndexByShotId(shots);
  return selection.shotIds
    .map((shotId) => indexByShotId.get(shotId))
    .filter((index): index is number => index !== undefined)
    .sort((left, right) => left - right)
    .map((index) => shotDisplayLabel(index));
}

export function takeShotSelectionTagLabel(
  shots: SceneShot[],
  selection: { shotIds: string[] } | null
): string | null {
  if (!selection || selection.shotIds.length === 0) {
    return null;
  }
  const numbers = takeShotSelectionLabels(shots, selection).map((label) =>
    Number(label.replace('Shot ', ''))
  );
  if (numbers.length === 1) {
    return `Shot ${numbers[0]}`;
  }
  return `Shot ${numbers[0]}-${numbers[numbers.length - 1]}`;
}

export function isMultiShotSelection(selection: { shotIds: string[] } | null): boolean {
  return Boolean(selection && selection.shotIds.length > 1);
}

export function takeShotSelectionDraftsEqual(
  left: TakeShotSelectionDraft[],
  right: TakeShotSelectionDraft[]
): boolean {
  const normalizedLeft = comparableDraftSelections(left);
  const normalizedRight = comparableDraftSelections(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((selection, index) => {
      const other = normalizedRight[index];
      return (
        other &&
        selection.takeId === other.takeId &&
        selection.shotIds === other.shotIds
      );
    })
  );
}

export function summarizeTakeShotSelectionChanges(input: {
  shots: SceneShot[];
  persistedDraftSelections: TakeShotSelectionDraft[];
  draftSelections: TakeShotSelectionDraft[];
}): TakeShotSelectionChangeSummary {
  const persisted = input.persistedDraftSelections[0] ?? null;
  const draft = input.draftSelections[0] ?? null;
  if (!persisted && !draft) {
    return { messages: ['No selection changes to apply.'], changedPromptCount: 0 };
  }
  if (
    persisted &&
    draft &&
    sameShotIds(
      orderShotIds(input.shots, persisted.shotIds),
      orderShotIds(input.shots, draft.shotIds)
    )
  ) {
    return { messages: ['No selection changes to apply.'], changedPromptCount: 0 };
  }

  return {
    messages: [
      summarizeSingleTakeSelectionChange({
        shots: input.shots,
        persistedShotIds: persisted?.shotIds ?? [],
        draftShotIds: draft?.shotIds ?? [],
      }),
    ],
    changedPromptCount: 1,
  };
}

function selectOpenTakeDraft(input: {
  draftSelections: TakeShotSelectionDraft[];
  createDraftSelectionId: () => string;
}): TakeShotSelectionDraft {
  const firstDraft = input.draftSelections[0];
  if (firstDraft) {
    return firstDraft;
  }
  return {
    draftSelectionId: input.createDraftSelectionId(),
    shotIds: [],
  };
}

function removeSelectedShot(input: {
  currentIndexes: number[];
  clickedIndex: number;
  shots: SceneShot[];
}): string[] {
  if (input.currentIndexes.length === 1) {
    return [];
  }
  const firstIndex = input.currentIndexes[0];
  const lastIndex = input.currentIndexes[input.currentIndexes.length - 1];
  if (input.clickedIndex === firstIndex) {
    return shotIdsForIndexes(
      input.shots,
      input.currentIndexes.filter((index) => index !== input.clickedIndex)
    );
  }
  if (input.clickedIndex === lastIndex) {
    return shotIdsForIndexes(
      input.shots,
      input.currentIndexes.filter((index) => index !== input.clickedIndex)
    );
  }
  return shotIdsForIndexes(
    input.shots,
    input.currentIndexes.filter((index) => index < input.clickedIndex)
  );
}

function shouldExpandSelection(
  currentIndexes: number[],
  clickedIndex: number
): boolean {
  if (currentIndexes.length === 0) {
    return false;
  }
  return (
    clickedIndex === currentIndexes[0] - 1 ||
    clickedIndex === currentIndexes[currentIndexes.length - 1] + 1
  );
}

function summarizeSingleTakeSelectionChange(input: {
  shots: SceneShot[];
  persistedShotIds: string[];
  draftShotIds: string[];
}): string {
  const persistedShotIds = orderShotIds(input.shots, input.persistedShotIds);
  const draftShotIds = orderShotIds(input.shots, input.draftShotIds);
  const persistedShotIdSet = new Set(persistedShotIds);
  const draftShotIdSet = new Set(draftShotIds);
  const removedShotIds = persistedShotIds.filter(
    (shotId) => !draftShotIdSet.has(shotId)
  );
  const addedShotIds = draftShotIds.filter(
    (shotId) => !persistedShotIdSet.has(shotId)
  );

  if (removedShotIds.length > 0 && addedShotIds.length > 0) {
    return `Deselect ${selectionRangeLabel(input.shots, { shotIds: removedShotIds })} and select ${selectionRangeLabel(input.shots, { shotIds: addedShotIds })}.`;
  }
  if (persistedShotIds.length === 0 && addedShotIds.length > 0) {
    return `Select ${selectionRangeLabel(input.shots, { shotIds: addedShotIds })}.`;
  }
  if (addedShotIds.length > 0) {
    return `Expand selection from ${selectionRangeLabel(input.shots, { shotIds: persistedShotIds })} to ${selectionRangeLabel(input.shots, { shotIds: draftShotIds })}.`;
  }
  if (removedShotIds.length > 0 && draftShotIds.length > 0) {
    return `Change selection from ${selectionRangeLabel(input.shots, { shotIds: persistedShotIds })} to ${selectionRangeLabel(input.shots, { shotIds: draftShotIds })}.`;
  }
  if (removedShotIds.length > 0) {
    return `Deselect ${selectionRangeLabel(input.shots, { shotIds: removedShotIds })}.`;
  }
  return 'No selection changes to apply.';
}

function resolveSelections(
  shots: SceneShot[],
  selections: VisibleTakeScopedShotSelection[]
): ResolvedSelection[] {
  const indexByShotId = buildIndexByShotId(shots);
  return selections
    .map((selection) => ({
      selectionId: visibleSelectionId(selection),
      indexes: selection.shotIds
        .map((shotId) => indexByShotId.get(shotId))
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => left - right),
    }))
    .filter((resolved) => resolved.indexes.length > 0)
    .sort((left, right) => left.indexes[0] - right.indexes[0]);
}

function normalizeDraftSelections(
  shots: SceneShot[],
  selections: TakeShotSelectionDraft[]
): TakeShotSelectionDraft[] {
  return selections
    .map((selection) => ({
      ...selection,
      shotIds: orderShotIds(shots, selection.shotIds),
    }))
    .sort(
      (left, right) =>
        firstShotIndex(shots, left.shotIds) -
        firstShotIndex(shots, right.shotIds)
    );
}

function comparableDraftSelections(selections: TakeShotSelectionDraft[]) {
  return normalizeDraftIdentity(selections)
    .map((selection) => ({
      takeId: selection.takeId ?? null,
      shotIds: selection.shotIds.join(','),
    }));
}

function normalizeDraftIdentity(
  selections: TakeShotSelectionDraft[]
): TakeShotSelectionDraft[] {
  if (selections.length === 0) {
    return [];
  }
  const first = selections[0];
  return [
    {
      draftSelectionId: first.draftSelectionId,
      ...(first.takeId ? { takeId: first.takeId } : {}),
      shotIds: [...first.shotIds],
    },
  ];
}

function selectionRangeLabel(
  shots: SceneShot[],
  selection: { shotIds: string[] }
): string {
  const labels = takeShotSelectionLabels(shots, selection);
  if (labels.length === 0) {
    return 'selection';
  }
  if (labels.length === 1) {
    return labels[0] ?? 'selection';
  }
  return `${labels[0]}-${labels[labels.length - 1]?.replace('Shot ', '')}`;
}

function orderShotIds(shots: SceneShot[], shotIds: string[]): string[] {
  const requested = new Set(shotIds);
  return shots
    .filter((shot) => requested.has(shot.shotId))
    .map((shot) => shot.shotId);
}

function shotIdsForIndexes(shots: SceneShot[], indexes: number[]): string[] {
  const requestedIndexes = new Set(indexes);
  return shots
    .filter((_shot, index) => requestedIndexes.has(index))
    .map((shot) => shot.shotId);
}

function orderedSelectionIndexes(shots: SceneShot[], shotIds: string[]): number[] {
  const indexByShotId = buildIndexByShotId(shots);
  return shotIds
    .map((shotId) => indexByShotId.get(shotId))
    .filter((index): index is number => index !== undefined)
    .sort((left, right) => left - right);
}

function firstShotIndex(shots: SceneShot[], shotIds: string[]): number {
  const indexByShotId = buildIndexByShotId(shots);
  return indexByShotId.get(shotIds[0] ?? '') ?? Number.MAX_SAFE_INTEGER;
}

function visibleSelectionId(selection: VisibleTakeScopedShotSelection): string {
  return 'draftSelectionId' in selection ? selection.draftSelectionId : selection.takeId;
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
