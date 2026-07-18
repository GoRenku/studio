import type { GenerationSpecRecord } from '../../client/generation.js';
import { freezeGenerationSpecRecord, readGenerationSpecRecord } from '../database/access/media-generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type { GenerationPurposeContract } from './purpose-contract.js';
import { validateGenerationSpecEnvelope } from './spec-envelope.js';

export function assertGenerationSpecMutable(record: GenerationSpecRecord): void {
  if (record.frozenAt !== null) {
    throw new ProjectDataError(
      'CORE_GENERATION_SPEC_FROZEN',
      'A submitted generation request cannot be changed.',
      { suggestion: 'Save the changed request as a new generation spec.' }
    );
  }
}

export function freezeGenerationSpec(input: {
  id: string;
  purpose: GenerationPurposeContract;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  const record = requireGenerationSpecRecord(input.session, input.id);
  if (record.spec.executionKind !== 'agent-external') {
    throw new ProjectDataError(
      'CORE_GENERATION_EXTERNAL_EXECUTION_REQUIRED',
      'The explicit freeze command is only for agent-external generation requests.',
      { suggestion: 'Use generation run for Renku-managed execution.' }
    );
  }
  assertValidEnvelope(record, input.purpose);
  return freezeExactGenerationSpec({ ...input, record });
}

export function freezeManagedGenerationSpec(input: {
  record: GenerationSpecRecord;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  if (input.record.spec.executionKind !== 'renku-managed') {
    throw new ProjectDataError(
      'CORE_GENERATION_EXTERNAL_EXECUTION_REQUIRED',
      'Agent-external generation must be frozen and executed through the agent workflow.'
    );
  }
  return freezeExactGenerationSpec(input);
}

function freezeExactGenerationSpec(input: {
  record: GenerationSpecRecord;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord {
  if (input.record.frozenAt !== null) {
    return input.record;
  }
  const frozen = freezeGenerationSpecRecord(input.session, {
    record: input.record,
    frozenAt: input.now,
  });
  if (!frozen) {
    throw new ProjectDataError(
      'CORE_GENERATION_SPEC_FREEZE_CONFLICT',
      'The generation request changed before it could be frozen.',
      { suggestion: 'Reread, validate, and review the current saved request before trying again.' }
    );
  }
  return requireGenerationSpecRecord(input.session, input.record.id);
}

function assertValidEnvelope(record: GenerationSpecRecord, purpose: GenerationPurposeContract): void {
  const issues = validateGenerationSpecEnvelope({ spec: record.spec, purpose });
  if (issues.length > 0) {
    throw new ProjectDataError(issues[0]!.code, issues[0]!.message, { issues });
  }
}

function requireGenerationSpecRecord(session: DatabaseSession, id: string): GenerationSpecRecord {
  const record = readGenerationSpecRecord(session, id);
  if (!record) {
    throw new ProjectDataError('CORE_GENERATION_SPEC_NOT_FOUND', `Generation spec was not found: ${id}.`);
  }
  return record;
}
