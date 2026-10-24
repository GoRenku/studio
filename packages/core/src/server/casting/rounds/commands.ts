import { CASTING_CANDIDATE_STATUSES } from '../../../client/casting/model.js';
import type {
  CastingCandidateStatusReport,
  CastingLookReport,
  CastingRoundReport,
} from '../../../client/casting/model.js';
import { assetFileOwnerKey } from '../../asset-files/owner-keys.js';
import { readAssetFileRecordIncludingDiscarded } from '../../database/access/asset-files.js';
import { readCastLookRecord } from '../../database/access/casting/looks.js';
import {
  insertCastingRoundRecord,
  nextCastingRoundNumber,
  readCastingCandidateRecord,
  readCastingRoundRecord,
  updateCastingCandidateStatusRecord,
} from '../../database/access/casting/rounds.js';
import { readProjectRecord } from '../../database/access/project.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { createRandomIdGenerator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import { withProject } from '../../project-operation.js';
import { assertCastingRoundCreateShape } from '../documents.js';
import { castingIssue, lookNotFound, throwCastingIssues } from '../diagnostics.js';
import type {
  CastingCandidateStatusInput,
  CastingDocumentInput,
  CastingProjectInput,
} from '../../project-data-service-contracts.js';
import { readSceneOrder, toCastLook } from '../projection.js';
import { castingReportBase } from '../report.js';
import { listCastingRoundViews } from './views.js';

/** Records a confirmed round before its candidates are generated; references must be the Cast Member's own files. */
export async function createCastingRound(input: CastingDocumentInput): Promise<CastingRoundReport> {
  return withProject(input, ({ session }) => {
    assertCastingRoundCreateShape(input.document, input.filePath);
    const document = input.document;
    const look = readCastLookRecord(session, document.lookId);
    if (!look) {
      throw lookNotFound(document.lookId);
    }
    const ownerKey = assetFileOwnerKey({ kind: 'castMember', id: look.castMemberId });
    const issues = document.referenceAssetFileIds.flatMap((assetFileId, index) => {
      const record = readAssetFileRecordIncludingDiscarded(session, assetFileId);
      return record && !record.discardedAt && record.ownerKey === ownerKey
        ? []
        : [castingIssue('CASTING_ROUND_REFERENCE_NOT_OWNED', `Reference ${assetFileId} is not an active file of this Cast Member.`, ['referenceAssetFileIds', String(index)], 'Use casting candidates or sheets of the same Cast Member as references.')];
    });
    if (issues.length > 0) {
      throwCastingIssues(issues);
    }
    const round = {
      id: (input.idGenerator ?? createRandomIdGenerator()).next('casting_round'),
      lookId: look.id,
      number: nextCastingRoundNumber(session, look.id),
      routes: document.routes,
      maxConcurrentGenerations: document.maxConcurrentGenerations,
      referenceAssetFileIds: document.referenceAssetFileIds,
      estimatedCost: document.estimatedCost,
      createdAt: new Date().toISOString(),
    };
    insertCastingRoundRecord(session, round);
    return { ...castingReportBase(readProjectRecord(session), look.castMemberId), round };
  });
}

export async function showCastingLook(input: CastingProjectInput & { lookId: string }): Promise<CastingLookReport> {
  return withProject(input, ({ session }) => {
    const look = readCastLookRecord(session, input.lookId);
    if (!look) {
      throw lookNotFound(input.lookId);
    }
    return {
      ...castingReportBase(readProjectRecord(session), look.castMemberId),
      look: toCastLook(session, look, readSceneOrder(session)),
      rounds: listCastingRoundViews(session, look.id),
    };
  });
}

export async function setCastingCandidateStatus(
  input: CastingCandidateStatusInput
): Promise<CastingCandidateStatusReport> {
  return withProject(input, ({ session }) => {
    if (!(CASTING_CANDIDATE_STATUSES as readonly string[]).includes(input.status)) {
      throwCastingIssues([castingIssue('CASTING_CANDIDATE_STATUS_INVALID', `Unknown casting candidate status: ${String(input.status)}.`, ['status'], 'Use candidate, shortlisted or hidden.')]);
    }
    const castMemberId = requireCandidateCastMember(session, input.assetFileId);
    updateCastingCandidateStatusRecord(session, { assetFileId: input.assetFileId, status: input.status });
    return {
      ...castingReportBase(readProjectRecord(session), castMemberId),
      candidate: readCastingCandidateRecord(session, input.assetFileId)!,
    };
  });
}

function requireCandidateCastMember(session: DatabaseSession, assetFileId: string): string {
  const candidate = readCastingCandidateRecord(session, assetFileId);
  const round = candidate ? readCastingRoundRecord(session, candidate.roundId) : null;
  const look = round ? readCastLookRecord(session, round.lookId) : null;
  if (!look) {
    throw new ProjectDataError('CASTING_CANDIDATE_NOT_FOUND', `Casting candidate was not found: ${assetFileId}.`, {
      suggestion: 'List the candidates with `renku cast casting show --look <look-id>`.',
    });
  }
  return look.castMemberId;
}
