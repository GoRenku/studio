import { createProjectDataService } from '@gorenku/studio-core/server';
import type { CastCastingResource } from '@gorenku/studio-core/client';
import type { CastingBoardRound, CastingCandidateBoard } from './contracts.js';
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
    rounds: look.rounds.map((round): CastingBoardRound => ({
      id: round.id,
      number: round.number,
      routes: round.routes,
      estimatedCost: round.estimatedCost,
      expectedCount: round.expectedCount,
      pending: pendingCandidates(round),
      candidates: round.candidates.map((candidate) => ({
        assetFileId: candidate.assetFileId,
        status: candidate.status,
        model: candidate.model,
        imageUri: record.media.uri(candidate.assetFile.projectRelativePath),
      })),
    })),
    action: record.action,
    lastCompletedAction: record.lastCompletedAction,
  });
}

/** Route counts per model key minus the candidates imported for that model. */
function pendingCandidates(round: CastingResourceLook['rounds'][number]): CastingBoardRound['pending'] {
  const pending = new Map<string, { model: CastingBoardRound['pending'][number]['model']; count: number }>();
  for (const route of round.routes) {
    const entry = pending.get(route.model.key) ?? { model: route.model, count: 0 };
    entry.count += route.count;
    pending.set(route.model.key, entry);
  }
  for (const candidate of round.candidates) {
    const entry = pending.get(candidate.modelKey);
    if (entry) entry.count -= 1;
  }
  return [...pending.values()].filter((entry) => entry.count > 0);
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
