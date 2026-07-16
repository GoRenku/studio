import type {
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
import type { GenerationPurposeContract } from './purpose-contract.js';

export function createGenerationSpec(input: {
  id: string;
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
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
  purpose: GenerationPurposeContract;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  const current = readGenerationSpec({ id: input.id, session: input.session });
  assertGenerationSpecIdentity(current.spec, input.spec);
  assertGenerationSpecEditingEnvelope(input.spec, input.purpose);
  return updateGenerationSpecRecord(input.session, {
    id: input.id,
    spec: cloneGenerationSpec(input.spec),
    createdAt: current.createdAt,
    updatedAt: input.now,
  });
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
  purpose: GenerationPurposeContract
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
    if (selection.placement.kind === 'slot') {
      assertSlotPlacement(selection);
      const key = selectionPlacementKey(selection);
      const count = (oneSlotSelections.get(key) ?? 0) + 1;
      oneSlotSelections.set(key, count);
      if (count > 1) {
        throw new ProjectDataError(
          'CORE_GENERATION_SELECTION_INVALID',
          `Generation reference slot ${selection.placement.sectionId}/${selection.placement.slotId} accepts one current selection.`
        );
      }
    }
  }
}

function assertSlotPlacement(selection: GenerationReferenceSelection): void {
  const placement = selection.placement;
  if (placement.kind !== 'slot') {
    return;
  }
  if (!placement.sectionId.trim() || !placement.slotId.trim() ||
      (placement.subject && (!placement.subject.kind.trim() || !placement.subject.id.trim()))) {
    throw new ProjectDataError(
      'CORE_GENERATION_SELECTION_INVALID',
      `Generation reference slot placement must identify a non-empty section, slot, and optional subject: ${selection.id}.`
    );
  }
}

function assertGenerationSpecIdentity(current: GenerationSpec, updated: GenerationSpec): void {
  if (current.purpose !== updated.purpose) {
    throw new ProjectDataError(
      'CORE_GENERATION_PURPOSE_IMMUTABLE',
      'A persisted generation spec cannot change purpose.'
    );
  }
  if (current.target.kind !== updated.target.kind || current.target.id !== updated.target.id) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_IMMUTABLE',
      'A persisted generation spec cannot change target.'
    );
  }
}

function selectionPlacementKey(selection: GenerationReferenceSelection): string {
  if (selection.placement.kind === 'additional') {
    return 'additional';
  }
  const subject = selection.placement.subject;
  return [
    selection.placement.sectionId,
    selection.placement.slotId,
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
