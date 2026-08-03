import type {
  Screenplay,
  ScreenplayPlacement,
  ScreenplayStructureEntry,
} from '../../../client/screenplay/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ScreenplayIdentityResolver } from './screenplay.js';

export function placeStructureEntry(input: {
  screenplay: Screenplay;
  entry: ScreenplayStructureEntry;
  placement: ScreenplayPlacement;
  resolver: ScreenplayIdentityResolver;
}): void {
  const parentSectionId = input.placement.parentSection
    ? input.resolver.reference(input.placement.parentSection)
    : undefined;
  input.screenplay.structure = input.screenplay.structure.filter(
    (entry) => entry.id !== input.entry.id,
  );
  normalizePositions(input.screenplay.structure);
  const siblings = orderedSiblings(input.screenplay.structure, parentSectionId);
  const index = placementIndex({
    placement: input.placement,
    siblings,
    parentSectionId,
    resolver: input.resolver,
  });
  siblings.splice(
    index,
    0,
    parentSectionId
      ? { ...input.entry, parentSectionId }
      : removeParentSectionId(input.entry),
  );
  reindexSiblings(siblings);
  const siblingIds = new Set(siblings.map((entry) => entry.id));
  input.screenplay.structure = [
    ...input.screenplay.structure.filter((entry) => !siblingIds.has(entry.id)),
    ...siblings,
  ];
  normalizePositions(input.screenplay.structure);
}

export function deleteSectionAndSpliceChildren(
  screenplay: Screenplay,
  sectionId: string,
): void {
  const section = screenplay.sections.find((value) => value.id === sectionId);
  const placement = screenplay.structure.find(
    (entry) => entry.content.type === 'section' && entry.content.sectionId === sectionId,
  );
  if (!section || !placement) {
    throw new ProjectDataError(
      'SCREENPLAY_SECTION_NOT_FOUND',
      `Screenplay Section ${sectionId} does not exist.`,
    );
  }
  const siblings = orderedSiblings(screenplay.structure, placement.parentSectionId);
  const placementIndex = siblings.findIndex((entry) => entry.id === placement.id);
  const children = orderedSiblings(screenplay.structure, sectionId).map((entry) =>
    placement.parentSectionId
      ? { ...entry, parentSectionId: placement.parentSectionId }
      : removeParentSectionId(entry)
  );
  siblings.splice(placementIndex, 1, ...children);
  reindexSiblings(siblings);
  const removedIds = new Set([placement.id, ...children.map((entry) => entry.id)]);
  screenplay.structure = [
    ...screenplay.structure.filter((entry) => !removedIds.has(entry.id)),
    ...siblings,
  ];
  screenplay.sections = screenplay.sections.filter((value) => value.id !== sectionId);
  normalizePositions(screenplay.structure);
}

export function normalizePositions(structure: ScreenplayStructureEntry[]): void {
  const groups = new Map<string | undefined, ScreenplayStructureEntry[]>();
  for (const entry of structure) {
    const siblings = groups.get(entry.parentSectionId) ?? [];
    siblings.push(entry);
    groups.set(entry.parentSectionId, siblings);
  }
  for (const siblings of groups.values()) {
    siblings.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
    siblings.forEach((entry, position) => {
      entry.position = position;
    });
  }
}

function placementIndex(input: {
  placement: ScreenplayPlacement;
  siblings: ScreenplayStructureEntry[];
  parentSectionId?: string;
  resolver: ScreenplayIdentityResolver;
}): number {
  if ('at' in input.placement) {
    return input.placement.at === 'start' ? 0 : input.siblings.length;
  }
  const anchor = input.resolver.reference(
    'beforeEntry' in input.placement
      ? input.placement.beforeEntry
      : input.placement.afterEntry,
  );
  const anchorIndex = input.siblings.findIndex((entry) => entry.id === anchor);
  if (anchorIndex < 0) {
    throw new ProjectDataError(
      'SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND',
      `Structure entry ${anchor} is not a sibling under ${input.parentSectionId ?? 'root'}.`,
      { suggestion: 'Use an anchor entry under the requested parent Section.' },
    );
  }
  return 'beforeEntry' in input.placement ? anchorIndex : anchorIndex + 1;
}

function orderedSiblings(
  structure: ScreenplayStructureEntry[],
  parentSectionId?: string,
): ScreenplayStructureEntry[] {
  return structure
    .filter((entry) => entry.parentSectionId === parentSectionId)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

function reindexSiblings(siblings: ScreenplayStructureEntry[]): void {
  siblings.forEach((entry, position) => {
    entry.position = position;
  });
}

function removeParentSectionId(
  entry: ScreenplayStructureEntry,
): Omit<ScreenplayStructureEntry, 'parentSectionId'> {
  const { parentSectionId: _parentSectionId, ...rootEntry } = entry;
  return rootEntry;
}
