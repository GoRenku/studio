import { asc, desc, eq, inArray } from 'drizzle-orm';
import type {
  CastingCandidate,
  CastingCandidateStatus,
  CastingRound,
} from '../../../../client/casting/model.js';
import { castingCandidates, castingRounds } from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';
import {
  parseStoredCastingEstimatedCost,
  parseStoredCastingIdList,
  parseStoredCastingRoutes,
} from './stored-json.js';

export function listCastingRoundRecords(session: DatabaseSession, lookId: string): CastingRound[] {
  return session.db
    .select()
    .from(castingRounds)
    .where(eq(castingRounds.castLookId, lookId))
    .orderBy(desc(castingRounds.number))
    .all()
    .map(toRound);
}

export function readCastingRoundRecord(session: DatabaseSession, roundId: string): CastingRound | null {
  const row = session.db.select().from(castingRounds).where(eq(castingRounds.id, roundId)).get();
  return row ? toRound(row) : null;
}

export function nextCastingRoundNumber(session: DatabaseSession, lookId: string): number {
  const latest = session.db
    .select({ number: castingRounds.number })
    .from(castingRounds)
    .where(eq(castingRounds.castLookId, lookId))
    .orderBy(desc(castingRounds.number))
    .get();
  return (latest?.number ?? 0) + 1;
}

export function insertCastingRoundRecord(session: DatabaseSession, round: CastingRound): void {
  session.db.insert(castingRounds).values({
    id: round.id,
    castLookId: round.lookId,
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

function toRound(row: typeof castingRounds.$inferSelect): CastingRound {
  const location = ['castingRound', row.id];
  return {
    id: row.id,
    lookId: row.castLookId,
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
