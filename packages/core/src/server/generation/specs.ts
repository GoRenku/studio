import type { GenerationSpec, GenerationSpecRecord, GenerationTarget } from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  insertGenerationSpecRecord,
  listGenerationSpecRecords,
  readGenerationSpecRecord,
  updateGenerationSpecRecord,
} from '../database/access/media-generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { GenerationPurposeContract } from './purpose-contract.js';
import { validateGenerationSpecEnvelope } from './spec-envelope.js';
import { assertGenerationSpecMutable } from './spec-lifecycle.js';

export function createGenerationSpec(input: {
  id: string;
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  assertGenerationSpecEnvelope(input.spec, input.purpose);
  return insertGenerationSpecRecord(input.session, {
    id: input.id,
    spec: cloneGenerationSpec(input.spec),
    frozenAt: null,
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
  assertGenerationSpecMutable(current);
  assertGenerationSpecIdentity(current.spec, input.spec);
  assertGenerationSpecEnvelope(input.spec, input.purpose);
  return updateGenerationSpecRecord(input.session, {
    id: input.id,
    spec: cloneGenerationSpec(input.spec),
    frozenAt: current.frozenAt,
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

function assertGenerationSpecEnvelope(
  spec: GenerationSpec,
  purpose: GenerationPurposeContract
): void {
  const issues = validateGenerationSpecEnvelope({ spec, purpose });
  if (issues.length > 0) {
    throw new ProjectDataError(
      issues[0]!.code,
      issues[0]!.message,
      { issues }
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

function cloneGenerationSpec(spec: GenerationSpec): GenerationSpec {
  return structuredClone(spec);
}
