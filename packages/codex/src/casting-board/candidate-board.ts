import { createProjectDataService } from '@gorenku/studio-core/server';
import type { CastCastingResource } from '@gorenku/studio-core/client';
import { projectBoardRound } from './board-rounds.js';
import type { CastingCandidateBoard } from './contracts.js';
import { castingBoardError } from './diagnostics.js';
import type { CastingBoardSessionRecord, CastingBoardSubject } from './session-state.js';

type CandidateSubject = Extract<CastingBoardSubject, { mode: 'candidates' }>;
type CastingResourceLook = CastCastingResource['looks'][number];

/** Re-reads Core so polling shows candidates as the agent imports them and status changes made in Studio. */
export async function projectCandidateBoard(record: CastingBoardSessionRecord, subject: CandidateSubject, homeDir?: string): Promise<CastingCandidateBoard> {
  const { castMember, look } = await readCandidateBoardLook(record, subject, homeDir);
  return structuredClone({
    mode: 'candidates' as const,
    sessionId: record.sessionId,
    revision: record.revision,
    castMember,
    look: { id: look.id, name: look.name, castAssetFileId: look.castCandidate?.id ?? null },
    rounds: look.rounds.map((round) => projectBoardRound(record, round)),
    action: record.action,
    lastCompletedAction: record.lastCompletedAction,
  });
}

export async function readCandidateBoardLook(
  record: CastingBoardSessionRecord,
  subject: CandidateSubject,
  homeDir?: string,
): Promise<{ castMember: CastCastingResource['castMember']; look: CastingResourceLook }> {
  const resource = await createProjectDataService().readCastCastingResource({ projectName: record.projectRef.name, homeDir, castMemberId: subject.castMemberId });
  const look = resource.looks.find((candidate) => candidate.id === subject.lookId);
  if (!look) {
    throw castingBoardError('CODEX_CASTING_BOARD_NOT_FOUND', `Look ${subject.lookId} is no longer part of ${resource.castMember.name}.`, 'Ask the agent to open the casting board again.');
  }
  return { castMember: resource.castMember, look };
}
