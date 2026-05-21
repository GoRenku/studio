import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  Act,
  Placement,
  Scene,
  ScreenplayCommandChange,
  ScreenplayDocument,
  ScreenplayCommandReport,
  ScreenplayOperationDocument,
  Sequence,
} from '../../client/screenplay.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { validateScreenplayJsonDocument } from '../screenplay-json/validator.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { replaceScreenplayDocument, resolveScreenplayDocumentIds } from '../database/access/screenplay-persistence.js';

export async function applyScreenplayOperations(
  input: RenkuConfigPathOptions & {
    document: ScreenplayOperationDocument;
    filePath?: string;
    dryRun?: boolean;
    idGenerator?: ProjectIdGenerator;
  }
): Promise<ScreenplayCommandReport> {
  return await withCurrentProjectSession(input, ({ currentProject, session }) => {
    const warnings = validateScreenplayJsonDocument({
      value: input.document,
      kind: 'screenplayOperations',
      filePath: input.filePath,
    }).filter((issue) => issue.severity === 'warning');

    const base = readScreenplayDocumentFromSession(session);
    if (!base) {
      throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
        suggestion: 'Use `renku screenplay create` before applying revisions.',
      });
    }

    const { draft, changes } = buildScreenplayDraftForOperations(
      base,
      input.document
    );

    const resolved = resolveScreenplayDocumentIds({
      document: draft,
      existing: base,
      idGenerator: input.idGenerator,
      mode: 'mutation',
    });
    if (!input.dryRun) {
      replaceScreenplayDocument(session, resolved.document);
    }

    return {
      valid: true,
      warnings: [...warnings, ...resolved.warnings],
      project: { name: currentProject.projectName, id: currentProject.projectId },
      changes,
      generatedIds: resolved.generatedIds,
      resourceKeys: ['screenplay'],
    };
  });
}

export function buildScreenplayDraftForOperations(
  base: ScreenplayDocument,
  document: ScreenplayOperationDocument
): { draft: ScreenplayDocument; changes: ScreenplayCommandChange[] } {
  const draft = structuredClone(base);
  const changes: ScreenplayCommandChange[] = [];
  for (const operation of document.operations) {
    switch (operation.operation) {
      case 'screenplay.update':
        draft.screenplay = operation.screenplay;
        changes.push({ operation: operation.operation });
        break;
      case 'castMember.add':
        insertByPlacement(draft.cast, operation.castMember, operation.placement);
        changes.push({ operation: operation.operation });
        break;
      case 'castMember.update':
        replaceById(draft.cast, operation.castMember, 'cast member');
        changes.push({ operation: operation.operation, castMemberId: requiredId(operation.castMember) });
        break;
      case 'castMember.delete':
        removeById(draft.cast, operation.castMemberId, 'cast member');
        changes.push({ operation: operation.operation, castMemberId: operation.castMemberId });
        break;
      case 'castMember.move':
        moveById(draft.cast, operation.castMemberId, 'cast member', operation.placement);
        changes.push({ operation: operation.operation, castMemberId: operation.castMemberId });
        break;
      case 'location.add':
        insertByPlacement(draft.locations, operation.location, operation.placement);
        changes.push({ operation: operation.operation });
        break;
      case 'location.update':
        replaceById(draft.locations, operation.location, 'location');
        changes.push({ operation: operation.operation, locationId: requiredId(operation.location) });
        break;
      case 'location.delete':
        removeById(draft.locations, operation.locationId, 'location');
        changes.push({ operation: operation.operation, locationId: operation.locationId });
        break;
      case 'location.move':
        moveById(draft.locations, operation.locationId, 'location', operation.placement);
        changes.push({ operation: operation.operation, locationId: operation.locationId });
        break;
      case 'act.add':
        insertByPlacement(draft.acts, operation.act, operation.placement);
        changes.push({ operation: operation.operation });
        break;
      case 'act.update':
        replaceById(draft.acts, operation.act, 'act');
        changes.push({ operation: operation.operation, actId: requiredId(operation.act) });
        break;
      case 'act.delete':
        removeById(draft.acts, operation.actId, 'act');
        changes.push({ operation: operation.operation, actId: operation.actId });
        break;
      case 'act.move':
        moveById(draft.acts, operation.actId, 'act', operation.placement);
        changes.push({ operation: operation.operation, actId: operation.actId });
        break;
      case 'sequence.add':
        insertByPlacement(findAct(draft.acts, operation.actId).sequences, operation.sequence, operation.placement);
        changes.push({ operation: operation.operation });
        break;
      case 'sequence.update':
        replaceSequence(draft.acts, operation.sequence);
        changes.push({ operation: operation.operation, sequenceId: requiredId(operation.sequence) });
        break;
      case 'sequence.delete':
        removeSequence(draft.acts, operation.sequenceId);
        changes.push({ operation: operation.operation, sequenceId: operation.sequenceId });
        break;
      case 'sequence.move':
        moveSequence(draft.acts, operation.sequenceId, operation.fromActId, operation.toActId, operation.placement);
        changes.push({ operation: operation.operation, sequenceId: operation.sequenceId });
        break;
      case 'scene.add':
        insertByPlacement(findSequence(draft.acts, operation.sequenceId).scenes, operation.scene, operation.placement);
        changes.push({ operation: operation.operation });
        break;
      case 'scene.update':
        replaceScene(draft.acts, operation.scene);
        changes.push({ operation: operation.operation, sceneId: requiredId(operation.scene) });
        break;
      case 'scene.delete':
        removeScene(draft.acts, operation.sceneId);
        changes.push({ operation: operation.operation, sceneId: operation.sceneId });
        break;
      case 'scene.move':
        moveScene(draft.acts, operation.sceneId, operation.fromSequenceId, operation.toSequenceId, operation.placement);
        changes.push({ operation: operation.operation, sceneId: operation.sceneId });
        break;
    }
  }
  return { draft, changes };
}

function replaceById<T extends { id?: string }>(items: T[], next: T, label: string): void {
  const index = items.findIndex((item) => item.id === requiredId(next));
  if (index === -1) {
    throwNotFound(label);
  }
  items[index] = next;
}

function removeById<T extends { id?: string }>(items: T[], id: string, label: string): T {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    throwNotFound(label);
  }
  const [removed] = items.splice(index, 1);
  return removed;
}

function moveById<T extends { id?: string }>(
  items: T[],
  id: string,
  label: string,
  placement?: Placement
): void {
  const removed = removeById(items, id, label);
  insertByPlacement(items, removed, placement);
}

function insertByPlacement<T extends { id?: string }>(
  items: T[],
  value: T,
  placement?: Placement
): void {
  if (!placement) {
    items.push(value);
    return;
  }
  if (placement.position === 'only') {
    if (placement.beforeId || placement.afterId) {
      throwInvalidPlacementShape();
    }
    if (items.length > 0) {
      throw new ProjectDataError('PROJECT_DATA212', 'Only placement requires an empty target parent.', {
        suggestion: 'Use beforeId or afterId for a non-empty target parent.',
      });
    }
    items.push(value);
    return;
  }
  if (placement.beforeId && placement.afterId) {
    const afterIndex = findPlacementTargetIndex(items, placement.afterId);
    const beforeIndex = findPlacementTargetIndex(items, placement.beforeId);
    if (afterIndex + 1 !== beforeIndex) {
      throw new ProjectDataError(
        'PROJECT_DATA212',
        'Placement neighbors are not adjacent in the target parent.',
        {
          issues: [
            createDiagnosticError(
              'PROJECT_DATA212',
              'Placement neighbors are not adjacent in the target parent.',
              { path: ['placement'] },
              'Use adjacent beforeId and afterId values from the same target parent.'
            ),
          ],
          suggestion: 'Use adjacent beforeId and afterId values from the same target parent.',
        }
      );
    }
    items.splice(beforeIndex, 0, value);
    return;
  }
  if (placement.beforeId) {
    items.splice(findPlacementTargetIndex(items, placement.beforeId), 0, value);
    return;
  }
  if (placement.afterId) {
    items.splice(findPlacementTargetIndex(items, placement.afterId) + 1, 0, value);
    return;
  }
  throwInvalidPlacementShape();
}

function findPlacementTargetIndex<T extends { id?: string }>(items: T[], targetId: string): number {
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (targetIndex !== -1) {
    return targetIndex;
  }
  throw new ProjectDataError('PROJECT_DATA212', 'Placement target was not found in the target parent.', {
    issues: [
      createDiagnosticError(
        'PROJECT_DATA212',
        'Placement target was not found in the target parent.',
        { path: ['placement'] },
        'Use a placement target inside the same parent.'
      ),
    ],
    suggestion: 'Use a placement target inside the same parent.',
  });
}

function findAct(acts: Act[], actId: string): Act {
  const act = acts.find((candidate) => candidate.id === actId);
  if (!act) {
    throwNotFound('act');
  }
  return act;
}

function findSequence(acts: Act[], sequenceId: string): Sequence {
  for (const act of acts) {
    const sequence = act.sequences.find((candidate) => candidate.id === sequenceId);
    if (sequence) {
      return sequence;
    }
  }
  throwNotFound('sequence');
}

function replaceSequence(acts: Act[], sequence: Sequence): void {
  for (const act of acts) {
    const index = act.sequences.findIndex((candidate) => candidate.id === requiredId(sequence));
    if (index !== -1) {
      act.sequences[index] = sequence;
      return;
    }
  }
  throwNotFound('sequence');
}

function removeSequence(acts: Act[], sequenceId: string): Sequence {
  for (const act of acts) {
    const index = act.sequences.findIndex((candidate) => candidate.id === sequenceId);
    if (index !== -1) {
      const [removed] = act.sequences.splice(index, 1);
      return removed;
    }
  }
  throwNotFound('sequence');
}

function moveSequence(
  acts: Act[],
  sequenceId: string,
  fromActId: string,
  toActId: string,
  placement?: Placement
): void {
  if (!placement) {
    throwInvalidMovePlacement();
  }
  const fromAct = findAct(acts, fromActId);
  const toAct = findAct(acts, toActId);
  const sequence = removeByIdFromParent(
    fromAct.sequences,
    sequenceId,
    'sequence',
    'fromActId'
  );
  insertByPlacement(toAct.sequences, sequence, placement);
}

function replaceScene(acts: Act[], scene: Scene): void {
  for (const act of acts) {
    for (const sequence of act.sequences) {
      const index = sequence.scenes.findIndex((candidate) => candidate.id === requiredId(scene));
      if (index !== -1) {
        sequence.scenes[index] = scene;
        return;
      }
    }
  }
  throwNotFound('scene');
}

function removeScene(acts: Act[], sceneId: string): Scene {
  for (const act of acts) {
    for (const sequence of act.sequences) {
      const index = sequence.scenes.findIndex((candidate) => candidate.id === sceneId);
      if (index !== -1) {
        const [removed] = sequence.scenes.splice(index, 1);
        return removed;
      }
    }
  }
  throwNotFound('scene');
}

function moveScene(
  acts: Act[],
  sceneId: string,
  fromSequenceId: string,
  toSequenceId: string,
  placement?: Placement
): void {
  if (!placement) {
    throwInvalidMovePlacement();
  }
  const fromSequence = findSequence(acts, fromSequenceId);
  const toSequence = findSequence(acts, toSequenceId);
  const scene = removeByIdFromParent(
    fromSequence.scenes,
    sceneId,
    'scene',
    'fromSequenceId'
  );
  insertByPlacement(toSequence.scenes, scene, placement);
}

function requiredId(value: { id?: string }): string {
  if (!value.id) {
    throw new ProjectDataError('PROJECT_DATA206', 'Updates require an existing durable id.', {
      suggestion: 'Read the screenplay first and include the existing id in update operations.',
    });
  }
  return value.id;
}

function throwNotFound(label: string): never {
  throw new ProjectDataError('PROJECT_DATA210', `Unknown ${label} id.`, {
    suggestion: 'Read the screenplay first and use an existing id.',
  });
}

function throwInvalidMovePlacement(): never {
  throw new ProjectDataError('PROJECT_DATA212', 'Move operations require explicit placement.', {
    suggestion: 'Provide beforeId, afterId, or position: "only" for an empty target parent.',
  });
}

function removeByIdFromParent<T extends { id?: string }>(
  items: T[],
  id: string,
  label: string,
  parentField: string
): T {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new ProjectDataError(
      'PROJECT_DATA212',
      `${label} is not a child of the declared source parent.`,
      {
        issues: [
          createDiagnosticError(
            'PROJECT_DATA212',
            `${label} is not a child of the declared source parent.`,
            { path: [parentField] },
            'Use the current source parent id from the latest screenplay read.'
          ),
        ],
        suggestion: 'Use the current source parent id from the latest screenplay read.',
      }
    );
  }
  const [removed] = items.splice(index, 1);
  return removed;
}

function throwInvalidPlacementShape(): never {
  throw new ProjectDataError('PROJECT_DATA212', 'Placement must provide a valid target.', {
    issues: [
      createDiagnosticError(
        'PROJECT_DATA212',
        'Placement must provide beforeId, afterId, or position: "only".',
        { path: ['placement'] },
        'Provide beforeId, afterId, or position: "only".'
      ),
    ],
    suggestion: 'Provide beforeId, afterId, or position: "only".',
  });
}
