import type { CastingRoundView } from '../../../client/casting/model.js';
import { isAssetFileAvailableInSession, toAssetFile } from '../../asset-files/projection.js';
import { readAssetFileRecordIncludingDiscarded } from '../../database/access/asset-files.js';
import { listCastingCandidateRecords, listCastingRoundRecords } from '../../database/access/casting/rounds.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';

/** A Look's rounds, newest first, with each active candidate and its file. Discarded candidates drop out. */
export function listCastingRoundViews(session: DatabaseSession, lookId: string): CastingRoundView[] {
  const rounds = listCastingRoundRecords(session, lookId);
  const candidates = listCastingCandidateRecords(session, rounds.map((round) => round.id));
  return rounds.map((round) => ({
    ...round,
    expectedCount: round.routes.reduce((total, route) => total + route.count, 0),
    candidates: candidates
      .filter((candidate) => candidate.roundId === round.id)
      .flatMap((candidate) => {
        const record = readAssetFileRecordIncludingDiscarded(session, candidate.assetFileId);
        const route = round.routes.find((entry) => entry.model.key === candidate.modelKey);
        return record && route && isAssetFileAvailableInSession(session, record)
          ? [{ ...candidate, assetFile: toAssetFile(record), model: route.model }]
          : [];
      })
      .sort((a, b) => a.assetFile.createdAt.localeCompare(b.assetFile.createdAt)),
  }));
}
