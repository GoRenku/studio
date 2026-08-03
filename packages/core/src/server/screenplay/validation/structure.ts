import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  Scene,
  ScreenplaySection,
  ScreenplayStructureEntry,
} from '../../../client/screenplay/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export interface ScreenplayTraversal {
  orderedScenes: Scene[];
  orderedSections: ScreenplaySection[];
  orderedStructure: ScreenplayStructureEntry[];
}

export function validateScreenplayStructure(input: {
  scenes: Scene[];
  sections: ScreenplaySection[];
  structure: ScreenplayStructureEntry[];
}): { issues: DiagnosticIssue[]; traversal: ScreenplayTraversal | null } {
  const issues: DiagnosticIssue[] = [];
  const scenes = uniqueById(input.scenes, 'scene', issues);
  const sections = uniqueById(input.sections, 'section', issues);
  uniqueById(input.structure, 'structure entry', issues);

  const scenePlacements = new Map<string, number>();
  const sectionPlacements = new Map<string, number>();
  const siblings = new Map<string | null, ScreenplayStructureEntry[]>();

  for (const [index, entry] of input.structure.entries()) {
    const path = ['structure', String(index)];
    if (entry.parentSectionId && !sections.has(entry.parentSectionId)) {
      issues.push(issue(
        'SCREENPLAY_SECTION_NOT_FOUND',
        `Parent Section ${entry.parentSectionId} does not exist.`,
        [...path, 'parentSectionId'],
      ));
    }
    const parentKey = entry.parentSectionId ?? null;
    const group = siblings.get(parentKey) ?? [];
    group.push(entry);
    siblings.set(parentKey, group);

    if (entry.content.type === 'scene') {
      if (!scenes.has(entry.content.sceneId)) {
        issues.push(issue(
          'SCREENPLAY_STRUCTURE_INVALID',
          `Scene ${entry.content.sceneId} does not exist.`,
          [...path, 'content', 'sceneId'],
        ));
      }
      scenePlacements.set(
        entry.content.sceneId,
        (scenePlacements.get(entry.content.sceneId) ?? 0) + 1,
      );
    } else {
      if (!sections.has(entry.content.sectionId)) {
        issues.push(issue(
          'SCREENPLAY_SECTION_NOT_FOUND',
          `Section ${entry.content.sectionId} does not exist.`,
          [...path, 'content', 'sectionId'],
        ));
      }
      sectionPlacements.set(
        entry.content.sectionId,
        (sectionPlacements.get(entry.content.sectionId) ?? 0) + 1,
      );
    }
  }

  for (const scene of input.scenes) {
    if (scenePlacements.get(scene.id) !== 1) {
      issues.push(issue(
        'SCREENPLAY_STRUCTURE_INVALID',
        `Scene ${scene.id} must appear exactly once in structure.`,
        ['scenes', scene.id],
      ));
    }
  }
  for (const section of input.sections) {
    if (sectionPlacements.get(section.id) !== 1) {
      issues.push(issue(
        'SCREENPLAY_STRUCTURE_INVALID',
        `Section ${section.id} must appear exactly once in structure.`,
        ['sections', section.id],
      ));
    }
  }

  for (const [parentId, entries] of siblings) {
    entries.sort(compareEntry);
    entries.forEach((entry, index) => {
      if (entry.position !== index) {
        issues.push(issue(
          'SCREENPLAY_STRUCTURE_INVALID',
          `Sibling positions under ${parentId ?? 'root'} must be contiguous from zero.`,
          ['structure', entry.id, 'position'],
        ));
      }
      validateContainment({ entry, parentId, sections, issues });
    });
  }

  const traversal = traverseStructure({ scenes, sections, siblings, issues });
  if (
    traversal.orderedScenes.length !== scenes.size
    || traversal.orderedSections.length !== sections.size
    || traversal.orderedStructure.length !== input.structure.length
  ) {
    issues.push(issue(
      'SCREENPLAY_STRUCTURE_INVALID',
      'Every Scene, Section, and structure entry must be reachable from the Screenplay root.',
      ['structure'],
    ));
  }
  return { issues, traversal: issues.length === 0 ? traversal : null };
}

export function canonicalizeScreenplayStructure(input: {
  scenes: Scene[];
  sections: ScreenplaySection[];
  structure: ScreenplayStructureEntry[];
}): ScreenplayTraversal {
  const result = validateScreenplayStructure(input);
  if (!result.traversal || result.issues.length > 0) {
    throw new ProjectDataError(
      'SCREENPLAY_STRUCTURE_INVALID',
      'Cannot canonicalize an invalid Screenplay structure.',
      { suggestion: 'Resolve the reported Screenplay structure diagnostics first.' },
    );
  }
  return result.traversal;
}

function traverseStructure(input: {
  scenes: Map<string, Scene>;
  sections: Map<string, ScreenplaySection>;
  siblings: Map<string | null, ScreenplayStructureEntry[]>;
  issues: DiagnosticIssue[];
}): ScreenplayTraversal {
  const orderedScenes: Scene[] = [];
  const orderedSections: ScreenplaySection[] = [];
  const orderedStructure: ScreenplayStructureEntry[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (parentId: string | null): void => {
    for (const entry of input.siblings.get(parentId) ?? []) {
      orderedStructure.push(entry);
      if (entry.content.type === 'scene') {
        const scene = input.scenes.get(entry.content.sceneId);
        if (scene) {
          orderedScenes.push(scene);
        }
        continue;
      }
      const sectionId = entry.content.sectionId;
      if (visiting.has(sectionId)) {
        input.issues.push(issue(
          'SCREENPLAY_STRUCTURE_INVALID',
          `Section cycle includes ${sectionId}.`,
          ['structure', entry.id],
        ));
        continue;
      }
      if (visited.has(sectionId)) {
        continue;
      }
      const section = input.sections.get(sectionId);
      if (!section) {
        continue;
      }
      visiting.add(sectionId);
      orderedSections.push(section);
      visit(sectionId);
      visiting.delete(sectionId);
      visited.add(sectionId);
    }
  };

  visit(null);
  return { orderedScenes, orderedSections, orderedStructure };
}

function validateContainment(input: {
  entry: ScreenplayStructureEntry;
  parentId: string | null;
  sections: Map<string, ScreenplaySection>;
  issues: DiagnosticIssue[];
}): void {
  if (input.entry.content.type === 'scene' || input.parentId === null) {
    return;
  }
  const parent = input.sections.get(input.parentId);
  const child = input.sections.get(input.entry.content.sectionId);
  if (!parent || !child) {
    return;
  }
  if (parent.type !== 'act' || child.type !== 'sequence') {
    input.issues.push(issue(
      'SCREENPLAY_SECTION_CONTAINMENT_INVALID',
      `${parent.type} Section ${parent.id} cannot contain ${child.type} Section ${child.id}.`,
      ['structure', input.entry.id],
    ));
  }
}

function uniqueById<T extends { id: string }>(
  values: T[],
  label: string,
  issues: DiagnosticIssue[],
): Map<string, T> {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    if (result.has(value.id)) {
      issues.push(issue(
        'SCREENPLAY_STRUCTURE_INVALID',
        `Duplicate ${label} ID ${value.id}.`,
        [label, String(index), 'id'],
      ));
    }
    result.set(value.id, value);
  });
  return result;
}

function compareEntry(
  left: ScreenplayStructureEntry,
  right: ScreenplayStructureEntry,
): number {
  return left.position - right.position || left.id.localeCompare(right.id);
}

function issue(
  code: string,
  message: string,
  path: string[],
): DiagnosticIssue {
  return createDiagnosticError(
    code,
    message,
    { path, context: 'screenplay structure' },
    'Submit a complete, acyclic structure with one placement per Scene and Section.',
  );
}
