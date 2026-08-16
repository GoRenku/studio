import { useMemo } from 'react';
import type {
  ScreenplayStructureEntry,
  StudioSelection,
} from '@gorenku/studio-core/client';
import type { MovieStudioNavigationState } from '../../use-movie-studio-navigation';
import { ScreenplaySceneRow } from './scene-row';
import { ScreenplaySectionRow } from './section-row';
import { useExpandedSections } from './use-expanded-sections';

export function ScreenplayTree({
  navigation,
  selection,
  onSelect,
}: {
  navigation: MovieStudioNavigationState;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
}) {
  const structure = navigation.screenplay.screenplay.structure;
  const entriesByParent = useMemo(() => groupEntriesByParent(structure), [structure]);
  const { expandedSectionIds, toggleSection } = useExpandedSections(
    structure,
    selection
  );

  const renderEntry = (entry: ScreenplayStructureEntry): React.ReactNode => {
    if (entry.content.type === 'scene') {
      const scene = navigation.scenesById.get(entry.content.sceneId);
      return scene ? (
        <ScreenplaySceneRow
          key={entry.id}
          scene={scene}
          selection={selection}
          onSelect={onSelect}
        />
      ) : null;
    }
    const section = navigation.sectionsById.get(entry.content.sectionId);
    if (!section) return null;
    const expanded = expandedSectionIds.has(section.id);
    const children = entriesByParent.get(section.id) ?? [];
    return (
      <div key={entry.id} className='space-y-1'>
        <ScreenplaySectionRow
          section={section}
          sceneCount={countScenes(section.id, entriesByParent)}
          expanded={expanded}
          onToggle={() => toggleSection(section.id)}
        />
        {expanded ? (
          <div className='ml-4 space-y-1 border-l border-border/30 pl-2'>
            {children.map(renderEntry)}
          </div>
        ) : null}
      </div>
    );
  };

  return <div className='space-y-1'>{(entriesByParent.get(null) ?? []).map(renderEntry)}</div>;
}

function groupEntriesByParent(
  structure: ScreenplayStructureEntry[]
): Map<string | null, ScreenplayStructureEntry[]> {
  const grouped = new Map<string | null, ScreenplayStructureEntry[]>();
  for (const entry of structure) {
    const parent = entry.parentSectionId ?? null;
    const entries = grouped.get(parent) ?? [];
    entries.push(entry);
    grouped.set(parent, entries);
  }
  for (const entries of grouped.values()) {
    entries.sort((left, right) => left.position - right.position);
  }
  return grouped;
}

function countScenes(
  sectionId: string,
  entriesByParent: Map<string | null, ScreenplayStructureEntry[]>
): number {
  return (entriesByParent.get(sectionId) ?? []).reduce((total, entry) => {
    if (entry.content.type === 'scene') return total + 1;
    return total + countScenes(entry.content.sectionId, entriesByParent);
  }, 0);
}
