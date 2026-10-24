import { createProjectDataService } from '@gorenku/studio-core/server';
import type { CastCastingResource, CastingCandidateStatus } from '@gorenku/studio-core/client';
import { notifyPanelProjectWrite } from '../panel-sessions/project-notifications.js';
import { assertBoardIdle, startBoardRequest } from './board-requests.js';
import { readCandidateBoardLook } from './candidate-board.js';
import { castingBoardError } from './diagnostics.js';
import { boardSubject } from './session-projection.js';
import type { CastingBoardActionContext, CastingBoardSessionRecord, CastingBoardSubject } from './session-state.js';

type CandidateStatusAction = { kind: 'shortlist' | 'hide' | 'restore'; assetFileId: string };

const CANDIDATE_STATUSES: Record<CandidateStatusAction['kind'], CastingCandidateStatus> = {
  shortlist: 'shortlisted',
  hide: 'hidden',
  restore: 'candidate',
};

/** Saves the candidate status through Core; it posts no message. */
export async function setBoardCandidateStatus(context: CastingBoardActionContext, action: CandidateStatusAction): Promise<null> {
  const { record, homeDir } = context;
  const { look } = await readCandidateBoardLook(record, candidateSubject(record), homeDir);
  requireBoardCandidate(look, action.assetFileId);
  const report = await createProjectDataService().setCastingCandidateStatus({
    projectName: record.projectRef.name,
    homeDir,
    assetFileId: action.assetFileId,
    status: CANDIDATE_STATUSES[action.kind],
  });
  await notifyPanelProjectWrite({ projectRef: record.projectRef, resourceKeys: report.resourceKeys, tool: 'casting.board.act', homeDir });
  context.state.touch(record.sessionId);
  return null;
}

/** Selects the candidate for the Look through Core, then waits for the agent to consume the cast. */
export async function castBoardCandidate(context: CastingBoardActionContext, action: { kind: 'cast'; assetFileId: string }): Promise<string> {
  const { record, homeDir } = context;
  const { look } = await readCandidateBoardLook(record, candidateSubject(record), homeDir);
  requireBoardCandidate(look, action.assetFileId);
  assertBoardIdle(record);
  const report = await createProjectDataService().selectAssetFile({
    projectName: record.projectRef.name,
    homeDir,
    target: { kind: 'castLook', id: look.id },
    assetFileId: action.assetFileId,
  });
  await notifyPanelProjectWrite({ projectRef: record.projectRef, resourceKeys: report.resourceKeys, tool: 'casting.board.act', homeDir });
  return startBoardRequest(context.state, record.sessionId, { kind: 'cast', lookId: look.id, assetFileId: action.assetFileId });
}

/** Sends the Look's shortlisted candidates and the notes so the agent can open a new round with them as references. */
export async function requestMoreLikeShortlist(context: CastingBoardActionContext, request: { kind: 'moreLikeShortlist'; notes: string }): Promise<string> {
  const { record, homeDir } = context;
  const { look } = await readCandidateBoardLook(record, candidateSubject(record), homeDir);
  const shortlistedAssetFileIds = look.rounds.flatMap((round) => round.candidates)
    .filter((candidate) => candidate.status === 'shortlisted')
    .map((candidate) => candidate.assetFileId);
  if (shortlistedAssetFileIds.length === 0) {
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', 'Shortlist at least one candidate first.');
  }
  assertBoardIdle(record);
  return startBoardRequest(context.state, record.sessionId, { kind: 'moreLikeShortlist', lookId: look.id, shortlistedAssetFileIds, notes: request.notes.trim() });
}

function candidateSubject(record: CastingBoardSessionRecord): Extract<CastingBoardSubject, { mode: 'candidates' }> {
  const subject = boardSubject(record, 'candidates');
  if (!subject) throw castingBoardError('CODEX_CASTING_BOARD_INVALID', 'This action belongs to a candidates board.');
  return subject;
}

function requireBoardCandidate(look: CastCastingResource['looks'][number], assetFileId: string): void {
  if (!look.rounds.some((round) => round.candidates.some((candidate) => candidate.assetFileId === assetFileId))) {
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', `Asset File ${assetFileId} is not a candidate on this board.`);
  }
}
