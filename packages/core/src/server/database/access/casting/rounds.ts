import { asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type {
  CastingCandidate,
  CastingCandidateStatus,
  CastingRound,
  CastingRoundSubject,
} from '../../../../client/casting/model.js';
import { castingCandidates, castingRounds } from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';
import {
  parseStoredCastingEstimatedCost,
  parseStoredCastingIdList,
  parseStoredCastingRoutes,
} from './stored-json.js';

/** The rounds of one Look or one costume, newest first. */
export function listCastingRoundRecords(session: DatabaseSession, subject: CastingRoundSubject): CastingRound[] {
  return session.db
    .select()
    .from(castingRounds)
    .where(subjectCondition(subject))
    .orderBy(desc(castingRounds.number))
    .all()
    .map(toRound);
}

export function readCastingRoundRecord(session: DatabaseSession, roundId: string): CastingRound | null {
  const row = session.db.select().from(castingRounds).where(eq(castingRounds.id, roundId)).get();
  return row ? toRound(row) : null;
}

export function nextCastingRoundNumber(session: DatabaseSession, subject: CastingRoundSubject): number {
  const latest = session.db
    .select({ number: castingRounds.number })
    .from(castingRounds)
    .where(subjectCondition(subject))
    .orderBy(desc(castingRounds.number))
    .get();
  return (latest?.number ?? 0) + 1;
}

export function insertCastingRoundRecord(session: DatabaseSession, round: CastingRound): void {
  session.db.insert(castingRounds).values({
    id: round.id,
    castLookId: round.subject.kind === 'castLook' ? round.subject.id : null,
    castCostumeId: round.subject.kind === 'castCostume' ? round.subject.id : null,
    number: round.number,
    routesJson: JSON.stringify(round.routes),
    maxConcurrentGenerations: round.maxConcurrentGenerations,
    referenceAssetFileIdsJson: JSON.stringify(round.referenceAssetFileIds),
    estimatedCostJson: round.estimatedCost ? JSON.stringify(round.estimatedCost) : null,
    createdAt: round.createdAt,
  }).run();
}

export function insertCastingCandidateRecord(
  session: DatabaseSession,
  input: { assetFileId: string; roundId: string; modelKey: string }
): void {
  session.db.insert(castingCandidates).values({
    assetFileId: input.assetFileId,
    castingRoundId: input.roundId,
    status: 'candidate',
    modelKey: input.modelKey,
  }).run();
}

export function readCastingCandidateRecord(session: DatabaseSession, assetFileId: string): CastingCandidate | null {
  const row = session.db.select().from(castingCandidates).where(eq(castingCandidates.assetFileId, assetFileId)).get();
  return row ? toCandidate(row) : null;
}

export function updateCastingCandidateStatusRecord(
  session: DatabaseSession,
  input: { assetFileId: string; status: CastingCandidateStatus }
): void {
  session.db.update(castingCandidates).set({ status: input.status }).where(eq(castingCandidates.assetFileId, input.assetFileId)).run();
}

export function listCastingCandidateRecords(session: DatabaseSession, roundIds: string[]): CastingCandidate[] {
  if (roundIds.length === 0) {
    return [];
  }
  return session.db
    .select()
    .from(castingCandidates)
    .where(inArray(castingCandidates.castingRoundId, roundIds))
    .orderBy(asc(castingCandidates.assetFileId))
    .all()
    .map(toCandidate);
}

/**
 * Deletes a removed costume's rounds and their candidate rows; returns the sheets that were in
 * them, which stay in the Cast Member's Assets.
 */
export function deleteCastingRoundRecordsForCostume(session: DatabaseSession, costumeId: string): string[] {
  const roundIds = listCastingRoundRecords(session, { kind: 'castCostume', id: costumeId }).map((round) => round.id);
  const released = listCastingCandidateRecords(session, roundIds).map((candidate) => candidate.assetFileId);
  if (roundIds.length > 0) {
    session.db.delete(castingCandidates).where(inArray(castingCandidates.castingRoundId, roundIds)).run();
    session.db.delete(castingRounds).where(inArray(castingRounds.id, roundIds)).run();
  }
  return released;
}

const SUBJECT_COLUMNS = {
  castLook: castingRounds.castLookId,
  castCostume: castingRounds.castCostumeId,
};

function subjectCondition(subject: CastingRoundSubject): SQL {
  return eq(SUBJECT_COLUMNS[subject.kind], subject.id);
}

function toSubject(row: typeof castingRounds.$inferSelect): CastingRoundSubject {
  // The table's check constraint keeps exactly one of the two columns set.
  return row.castCostumeId !== null
    ? { kind: 'castCostume', id: row.castCostumeId }
    : { kind: 'castLook', id: row.castLookId! };
}

function toRound(row: typeof castingRounds.$inferSelect): CastingRound {
  const location = ['castingRound', row.id];
  return {
    id: row.id,
    subject: toSubject(row),
    number: row.number,
    routes: parseStoredCastingRoutes(row.routesJson, [...location, 'routes']),
    maxConcurrentGenerations: row.maxConcurrentGenerations,
    referenceAssetFileIds: parseStoredCastingIdList(row.referenceAssetFileIdsJson, [...location, 'referenceAssetFileIds']),
    estimatedCost: parseStoredCastingEstimatedCost(row.estimatedCostJson, [...location, 'estimatedCost']),
    createdAt: row.createdAt,
  };
}

function toCandidate(row: typeof castingCandidates.$inferSelect): CastingCandidate {
  return { assetFileId: row.assetFileId, roundId: row.castingRoundId, status: row.status, modelKey: row.modelKey };
}
