import type {
  GenerationReferenceGuide,
  GenerationReferenceSelection,
  GenerationSpec,
  GenerationSpecRecord,
  GenerationTarget,
} from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import {
  insertGenerationSpecRecord,
  listGenerationSpecRecords,
  readGenerationSpecRecord,
  updateGenerationSpecRecord,
} from '../database/access/media-generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { GenerationPurposeEditingContract } from './purpose-contract.js';
import { requireShotVideoTakeAuthoringMutable } from '../database/access/shot-video-take-media.js';

const SINGLETON_TAKE_PURPOSES = new Set<GenerationSpec['purpose']>([
  'shot.first-frame',
  'shot.last-frame',
  'shot.video-prompt',
  'shot.video-take',
]);

export function createGenerationSpec(input: {
  id: string;
  spec: GenerationSpec;
  purpose: GenerationPurposeEditingContract;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  assertTakeSpecCanBeCreated(input);
  assertGenerationSpecEditingEnvelope(input.spec, input.purpose);
  return insertGenerationSpecRecord(input.session, {
    id: input.id,
    spec: cloneGenerationSpec(input.spec),
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function updateGenerationSpec(input: {
  id: string;
  spec: GenerationSpec;
  purpose: GenerationPurposeEditingContract;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  const current = readGenerationSpec({ id: input.id, session: input.session });
  assertTakeSpecCanBeEdited(input);
  assertGenerationSpecEditingEnvelope(input.spec, input.purpose);
  return updateGenerationSpecRecord(input.session, {
    id: input.id,
    spec: cloneGenerationSpec(input.spec),
    createdAt: current.createdAt,
    updatedAt: input.now,
  });
}

function assertTakeSpecCanBeCreated(input: {
  spec: GenerationSpec;
  session: DatabaseSession;
}): void {
  if (!isSingletonTakeSpec(input.spec)) {
    return;
  }
  requireShotVideoTakeAuthoringMutable({
    session: input.session,
    takeId: input.spec.target.id,
  });
  if (listGenerationSpecRecords(input.session, {
    purpose: input.spec.purpose,
    target: input.spec.target,
  }).length > 0) {
    throw new ProjectDataError(
      'CORE_GENERATION_TAKE_SPEC_ALREADY_EXISTS',
      `Shot Video Take already has a ${input.spec.purpose} generation spec.`
    );
  }
}

function assertTakeSpecCanBeEdited(input: {
  id: string;
  spec: GenerationSpec;
  session: DatabaseSession;
}): void {
  if (!isSingletonTakeSpec(input.spec)) {
    return;
  }
  requireShotVideoTakeAuthoringMutable({
    session: input.session,
    takeId: input.spec.target.id,
  });
  const duplicates = listGenerationSpecRecords(input.session, {
    purpose: input.spec.purpose,
    target: input.spec.target,
  }).filter((record) => record.id !== input.id);
  if (duplicates.length > 0) {
    throw new ProjectDataError(
      'CORE_GENERATION_TAKE_SPEC_ALREADY_EXISTS',
      `Shot Video Take already has another ${input.spec.purpose} generation spec.`
    );
  }
}

function isSingletonTakeSpec(spec: GenerationSpec): spec is GenerationSpec & {
  target: Extract<GenerationTarget, { kind: 'sceneShotVideoTake' }>;
} {
  return SINGLETON_TAKE_PURPOSES.has(spec.purpose) &&
    spec.target.kind === 'sceneShotVideoTake';
}

export function readGenerationSpec(input: {
  id: string;
  session: DatabaseSession;
}): GenerationSpecRecord {
  const record = readGenerationSpecRecord(input.session, input.id);
  if (!record) {
    throw new ProjectDataError(
      'CORE_GENERATION_SPEC_NOT_FOUND',
      `Generation spec was not found: ${input.id}.`
    );
  }
  return record;
}

export function listGenerationSpecs(input: {
  session: DatabaseSession;
  purpose?: string;
  target?: GenerationTarget;
}): GenerationSpecRecord[] {
  return listGenerationSpecRecords(input.session, {
    purpose: input.purpose,
    target: input.target,
  });
}

function assertGenerationSpecEditingEnvelope(
  spec: GenerationSpec,
  purpose: GenerationPurposeEditingContract
): void {
  if (spec.purpose !== purpose.purpose) {
    throw new ProjectDataError(
      'CORE_GENERATION_PURPOSE_INVALID',
      `Generation spec purpose ${spec.purpose} does not match ${purpose.purpose}.`
    );
  }
  if (spec.target.kind !== purpose.targetKind) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_INVALID',
      `Generation purpose ${purpose.purpose} requires target kind ${purpose.targetKind}, received ${spec.target.kind}.`
    );
  }
  const selectionIds = new Set<string>();
  const oneSlotSelections = new Map<string, number>();
  assertJsonRecord(spec.values, 'values');
  for (const selection of spec.references) {
    if (!selection.id || selectionIds.has(selection.id)) {
      throw new ProjectDataError(
        'CORE_GENERATION_SELECTION_INVALID',
        `Generation reference selection ids must be non-empty and unique: ${selection.id}.`
      );
    }
    selectionIds.add(selection.id);
    if (selection.providerField !== undefined && !selection.providerField.trim()) {
      throw new ProjectDataError(
        'CORE_GENERATION_SELECTION_INVALID',
        `Generation reference providerField must be omitted or non-empty: ${selection.id}.`
      );
    }
    if (selection.reference.kind === 'asset-file') {
      if (!selection.reference.assetId || !selection.reference.assetFileId) {
        throw new ProjectDataError(
          'CORE_GENERATION_SELECTION_INVALID',
          `Generation asset-file references require exact asset and file ids: ${selection.id}.`
        );
      }
    } else {
      const normalized = normalizeProjectRelativePath(
        selection.reference.projectRelativePath
      );
      if (normalized !== selection.reference.projectRelativePath) {
        throw new ProjectDataError(
          'CORE_GENERATION_SELECTION_INVALID',
          `Generation project-file references must already use normalized project-relative paths: ${selection.id}.`
        );
      }
    }
    const slot = findGuideSlot(purpose.referenceGuide, selection);
    if (!slot) {
      continue;
    }
    if (!slot.candidates.some((candidate) => referencesEqual(
      candidate.reference,
      selection.reference
    ))) {
      throw new ProjectDataError(
        'CORE_GENERATION_SELECTION_INVALID',
        `Generation reference is not a current candidate for guide slot ${slot.id}.`
      );
    }
    const key = selectionPlacementKey(selection);
    const count = (oneSlotSelections.get(key) ?? 0) + 1;
    oneSlotSelections.set(key, count);
    if (count > 1) {
      throw new ProjectDataError(
        'CORE_GENERATION_SELECTION_INVALID',
        `Generation guide slot ${slot.id} accepts one selection.`
      );
    }
  }
}

function referencesEqual(
  left: GenerationReferenceSelection['reference'],
  right: GenerationReferenceSelection['reference']
): boolean {
  return left.kind === 'asset-file' && right.kind === 'asset-file'
    ? left.assetId === right.assetId && left.assetFileId === right.assetFileId
    : left.kind === 'project-file' && right.kind === 'project-file'
      ? left.projectRelativePath === right.projectRelativePath
      : false;
}

function findGuideSlot(
  guide: GenerationReferenceGuide,
  selection: GenerationReferenceSelection
) {
  if (selection.placement.kind === 'additional') {
    return null;
  }
  const placement = selection.placement;
  const section = guide.sections.find(
    (candidate) =>
      candidate.id === placement.sectionId &&
      subjectsEqual(candidate.scope, placement.scope)
  );
  const slot = section?.slots.find((candidate) =>
    candidate.id === placement.slotId &&
    subjectsEqual(candidate.subject, placement.subject)
  );
  if (!slot) {
    throw new ProjectDataError(
      'CORE_GENERATION_SELECTION_INVALID',
      `Generation reference placement does not exist in the purpose guide: ${placement.sectionId}/${placement.slotId}.`
    );
  }
  return slot;
}

function subjectsEqual(
  left: { kind: string; id: string } | undefined,
  right: { kind: string; id: string } | undefined
): boolean {
  return left?.kind === right?.kind && left?.id === right?.id;
}

function selectionPlacementKey(selection: GenerationReferenceSelection): string {
  if (selection.placement.kind === 'additional') {
    return 'additional';
  }
  const subject = selection.placement.subject;
  return [
    selection.placement.sectionId,
    selection.placement.slotId,
    selection.placement.scope?.kind ?? '',
    selection.placement.scope?.id ?? '',
    subject?.kind ?? '',
    subject?.id ?? '',
  ].join('\0');
}

function cloneGenerationSpec(spec: GenerationSpec): GenerationSpec {
  return structuredClone(spec);
}

function assertJsonRecord(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidJsonValue(path);
  }
  for (const [key, child] of Object.entries(value)) {
    assertJsonValue(child, `${path}.${key}`);
  }
}

function assertJsonValue(value: unknown, path: string): void {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertJsonValue(child, `${path}.${index}`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertJsonValue(child, `${path}.${key}`);
    }
    return;
  }
  throw invalidJsonValue(path);
}

function invalidJsonValue(path: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_GENERATION_SPEC_INVALID',
    `Generation spec field ${path} must be a JSON value.`
  );
}
