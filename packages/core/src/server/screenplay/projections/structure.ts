import type {
  Scene,
  Screenplay,
  ScreenplaySection,
  ScreenplayStructureEntry,
} from '../../../client/screenplay/index.js';
import { canonicalizeScreenplayStructure } from '../validation/structure.js';

export interface CanonicalScreenplayProjection {
  scenes: Scene[];
  sections: ScreenplaySection[];
  structure: ScreenplayStructureEntry[];
  orderedSceneIds: string[];
}

export function projectCanonicalScreenplayStructure(
  screenplay: Screenplay,
): CanonicalScreenplayProjection {
  const traversal = canonicalizeScreenplayStructure(screenplay);
  return {
    scenes: traversal.orderedScenes,
    sections: traversal.orderedSections,
    structure: traversal.orderedStructure,
    orderedSceneIds: traversal.orderedScenes.map((scene) => scene.id),
  };
}

export function descendantSceneIds(
  screenplay: Screenplay,
  sectionId: string,
): string[] {
  const children = new Map<string | undefined, ScreenplayStructureEntry[]>();
  for (const entry of screenplay.structure) {
    const values = children.get(entry.parentSectionId) ?? [];
    values.push(entry);
    children.set(entry.parentSectionId, values);
  }
  for (const values of children.values()) {
    values.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  }
  const sceneIds: string[] = [];
  const visit = (parent: string): void => {
    for (const entry of children.get(parent) ?? []) {
      if (entry.content.type === 'scene') {
        sceneIds.push(entry.content.sceneId);
      } else {
        visit(entry.content.sectionId);
      }
    }
  };
  visit(sectionId);
  return sceneIds;
}
