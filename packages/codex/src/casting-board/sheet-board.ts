import { createProjectDataService } from '@gorenku/studio-core/server';
import type { CastCastingResource } from '@gorenku/studio-core/client';
import { projectBoardRound } from './board-rounds.js';
import type { CastingSheetBoard } from './contracts.js';
import { castingBoardError } from './diagnostics.js';
import type { CastingBoardSessionRecord, CastingBoardSubject } from './session-state.js';

type SheetSubject = Extract<CastingBoardSubject, { mode: 'sheets' }>;

/** Re-reads Core so polling shows sheets as the agent imports them and picks made in Studio. */
export async function projectSheetBoard(record: CastingBoardSessionRecord, subject: SheetSubject, homeDir?: string): Promise<CastingSheetBoard> {
  const { resource, look } = await readSheetBoardLook(record, subject, homeDir);
  return structuredClone({
    mode: 'sheets' as const,
    sessionId: record.sessionId,
    revision: record.revision,
    castMember: resource.castMember,
    look: { id: look.id, name: look.name },
    scenes: resource.scenes,
    focusCostumeId: subject.costumeId,
    costumes: lookCostumes(resource, look.id).map((costume) => ({
      id: costume.id,
      name: costume.name,
      sceneIds: costume.sceneIds,
      pickedAssetFileId: costume.characterSheetAssetFileId,
      rounds: costume.rounds.map((round) => projectBoardRound(record, round)),
    })),
    action: record.action,
    lastCompletedAction: record.lastCompletedAction,
  });
}

export async function readSheetBoardLook(
  record: CastingBoardSessionRecord,
  subject: SheetSubject,
  homeDir?: string,
): Promise<{ resource: CastCastingResource; look: CastCastingResource['looks'][number] }> {
  const resource = await createProjectDataService().readCastCastingResource({ projectName: record.projectRef.name, homeDir, castMemberId: subject.castMemberId });
  const look = resource.looks.find((candidate) => candidate.id === subject.lookId);
  if (!look) {
    throw castingBoardError('CODEX_CASTING_BOARD_NOT_FOUND', `Look ${subject.lookId} is no longer part of ${resource.castMember.name}.`, 'Ask the agent to open the casting board again.');
  }
  return { resource, look };
}

export function lookCostumes(resource: CastCastingResource, lookId: string): CastCastingResource['costumes'] {
  return resource.costumes.filter((costume) => costume.lookId === lookId);
}
