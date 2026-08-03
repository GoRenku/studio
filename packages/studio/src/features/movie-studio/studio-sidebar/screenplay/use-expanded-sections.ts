import { useMemo, useState } from 'react';
import type {
  ScreenplayStructureEntry,
  StudioSelection,
} from '@gorenku/studio-core/client';

export function useExpandedSections(
  structure: ScreenplayStructureEntry[],
  selection: StudioSelection
) {
  const parentBySectionId = useMemo(() => {
    const parents = new Map<string, string | null>();
    for (const entry of structure) {
      if (entry.content.type === 'section') {
        parents.set(entry.content.sectionId, entry.parentSectionId ?? null);
      }
    }
    return parents;
  }, [structure]);
  const selectionKey = selectionIdentity(selection);
  const autoExpandedSectionIds = useMemo(() => {
    const selectedSectionId =
      selection.type === 'section'
        ? selection.id
        : selection.type === 'scene'
          ? sectionForScene(structure, selection.id)
          : null;
    if (!selectedSectionId) return new Set<string>();
    const ancestors: string[] = [];
    let current: string | null = selectedSectionId;
    while (current) {
      ancestors.push(current);
      current = parentBySectionId.get(current) ?? null;
    }
    return new Set(ancestors);
  }, [parentBySectionId, selection, structure]);
  const [overridesBySelection, setOverridesBySelection] = useState<
    Map<string, Map<string, boolean>>
  >(() => new Map());
  const expandedSectionIds = useMemo(() => {
    const expanded = new Set(autoExpandedSectionIds);
    for (const [sectionId, value] of
      overridesBySelection.get(selectionKey) ?? []) {
      if (value) expanded.add(sectionId);
      else expanded.delete(sectionId);
    }
    return expanded;
  }, [autoExpandedSectionIds, overridesBySelection, selectionKey]);

  const toggleSection = (sectionId: string) => {
    const nextExpanded = !expandedSectionIds.has(sectionId);
    setOverridesBySelection((existing) => {
      const next = new Map(existing);
      const selectionOverrides = new Map(next.get(selectionKey) ?? []);
      selectionOverrides.set(sectionId, nextExpanded);
      next.set(selectionKey, selectionOverrides);
      return next;
    });
  };

  return { expandedSectionIds, toggleSection };
}

function sectionForScene(
  structure: ScreenplayStructureEntry[],
  sceneId: string
): string | null {
  return (
    structure.find(
      (entry) =>
        entry.content.type === 'scene' && entry.content.sceneId === sceneId
    )?.parentSectionId ?? null
  );
}

function selectionIdentity(selection: StudioSelection): string {
  return 'id' in selection
    ? `${selection.type}:${selection.id}`
    : selection.type;
}
