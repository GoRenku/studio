import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Block, ScreenplayDocument } from '../../client/screenplay.js';
import type {
  DepartmentGeneratedId,
  DepartmentPlacement,
  DepartmentProjectSummary,
} from '../../client/department-design.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectIdGenerator, EntityIdPrefix } from '../entity-ids.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../entity-ids.js';

export function projectSummary(input: {
  projectName: string;
  projectId?: string;
  projectFolder?: string;
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  summary?: string | null;
}): DepartmentProjectSummary {
  return {
    name: input.projectName,
    id: input.projectId,
    projectFolder: input.projectFolder,
    title: input.title,
    aspectRatio: input.aspectRatio,
    logline: input.logline,
    summary: input.summary,
  };
}

export function allocateDepartmentId(input: {
  prefix: EntityIdPrefix;
  key: string;
  kind: string;
  path: string[];
  idGenerator?: ProjectIdGenerator;
  generatedIds: DepartmentGeneratedId[];
}): string {
  const allocator = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const id = allocator(input.prefix);
  input.generatedIds.push({
    kind: input.kind,
    path: input.path,
    key: input.key,
    id,
  });
  return id;
}

export function assertNewObjectUsesKey(input: {
  id?: string;
  key?: string;
  path: string[];
  label: string;
  issues: DiagnosticIssue[];
}): void {
  if (input.id && input.key) {
    input.issues.push(
      createDiagnosticError(
        'PROJECT_DATA211',
        `${input.label} must provide either id or key, not both.`,
        { path: input.path },
        'Use key for a new record and id for an existing record.'
      )
    );
    return;
  }
  if (input.id) {
    input.issues.push(
      createDiagnosticError(
        'PROJECT_DATA211',
        `${input.label} cannot provide a durable id when adding a new record.`,
        { path: [...input.path, 'id'] },
        'Use key for newly created records.'
      )
    );
    return;
  }
  if (!input.key) {
    input.issues.push(
      createDiagnosticError(
        'PROJECT_DATA206',
        `${input.label} requires key.`,
        { path: [...input.path, 'key'] },
        'Use a request-local key for newly created records.'
      )
    );
  }
}

export function assertExistingObjectUsesId(input: {
  id?: string;
  key?: string;
  path: string[];
  label: string;
  issues: DiagnosticIssue[];
}): void {
  if (input.id && input.key) {
    input.issues.push(
      createDiagnosticError(
        'PROJECT_DATA211',
        `${input.label} must provide either id or key, not both.`,
        { path: input.path },
        'Use id for an existing record.'
      )
    );
    return;
  }
  if (input.key) {
    input.issues.push(
      createDiagnosticError(
        'PROJECT_DATA211',
        `${input.label} cannot use key when updating an existing record.`,
        { path: [...input.path, 'key'] },
        'Use the durable id from the latest list or show command.'
      )
    );
    return;
  }
  if (!input.id) {
    input.issues.push(
      createDiagnosticError(
        'PROJECT_DATA206',
        `${input.label} requires id.`,
        { path: [...input.path, 'id'] },
        'Use the durable id from the latest list or show command.'
      )
    );
  }
}

export function throwIfDepartmentIssues(issues: DiagnosticIssue[]): void {
  if (issues.length === 0) {
    return;
  }
  throw new ProjectDataError('PROJECT_DATA200', 'Department command failed validation.', {
    issues,
    suggestion: 'Fix the reported department command issues and run it again.',
  });
}

export function applyPlacement<T extends { id: string }>(
  items: T[],
  item: T,
  placement?: DepartmentPlacement
): T[] {
  const withoutItem = items.filter((candidate) => candidate.id !== item.id);
  if (!placement) {
    return [...withoutItem, item];
  }
  if (placement.position === 'only') {
    if (withoutItem.length > 0) {
      throwPlacementError('position: only can only be used with an otherwise empty list.');
    }
    return [item];
  }
  if (placement.beforeId) {
    const index = withoutItem.findIndex((candidate) => candidate.id === placement.beforeId);
    if (index === -1) {
      throwPlacementError(`Placement beforeId was not found: ${placement.beforeId}.`);
    }
    return [
      ...withoutItem.slice(0, index),
      item,
      ...withoutItem.slice(index),
    ];
  }
  if (placement.afterId) {
    const index = withoutItem.findIndex((candidate) => candidate.id === placement.afterId);
    if (index === -1) {
      throwPlacementError(`Placement afterId was not found: ${placement.afterId}.`);
    }
    return [
      ...withoutItem.slice(0, index + 1),
      item,
      ...withoutItem.slice(index + 1),
    ];
  }
  throwPlacementError('Placement requires beforeId, afterId, or position.');
}

export function moveByPlacement<T extends { id: string }>(
  items: T[],
  id: string,
  placement: DepartmentPlacement,
  label: string
): T[] {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new ProjectDataError('PROJECT_DATA205', `${label} was not found.`, {
      suggestion: 'Check the id from the latest list command.',
    });
  }
  return applyPlacement(items, item, placement);
}

export function collectReferencedCastMemberIds(
  screenplay: ScreenplayDocument
): Set<string> {
  const ids = new Set<string>();
  screenplay.acts.forEach((act) =>
    act.sequences.forEach((sequence) =>
      sequence.scenes.forEach((scene) =>
        scene.blocks.forEach((block) => collectBlockCastMemberIds(block, ids))
      )
    )
  );
  return ids;
}

export function collectReferencedLocationIds(
  screenplay: ScreenplayDocument
): Set<string> {
  const ids = new Set<string>();
  screenplay.acts.forEach((act) =>
    act.sequences.forEach((sequence) =>
      sequence.scenes.forEach((scene) => {
        scene.setting.locationIds?.forEach((locationId) => ids.add(locationId));
        scene.blocks.forEach((block) => block.locationIds?.forEach((locationId) => ids.add(locationId)));
      })
    )
  );
  return ids;
}

function collectBlockCastMemberIds(block: Block, ids: Set<string>): void {
  block.castMemberIds?.forEach((castMemberId) => ids.add(castMemberId));
  if (block.type === 'dialogue' && block.castMemberId) {
    ids.add(block.castMemberId);
  }
}

function throwPlacementError(message: string): never {
  throw new ProjectDataError('PROJECT_DATA212', message, {
    suggestion: 'Use a placement that references a current neighbor in the same list.',
  });
}
