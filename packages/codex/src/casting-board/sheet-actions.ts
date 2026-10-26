import { createProjectDataService } from '@gorenku/studio-core/server';
import { notifyPanelProjectWrite } from '../panel-sessions/project-notifications.js';
import { assertBoardIdle, startBoardRequest } from './board-requests.js';
import { keptImageIds } from './board-rounds.js';
import { castingBoardError } from './diagnostics.js';
import { boardSubject } from './session-projection.js';
import { lookCostumes, readSheetBoardLook } from './sheet-board.js';
import type { CastingBoardActionContext, CastingBoardSessionRecord, CastingBoardSubject } from './session-state.js';

/** Picks the sheet for the costume through Core, which checks it is a sheet of the costume's rounds; it posts no message. */
export async function pickBoardSheet(context: CastingBoardActionContext, action: { kind: 'pickSheet'; costumeId: string; assetFileId: string }): Promise<null> {
  const { record, homeDir } = context;
  await requireBoardCostume(record, action.costumeId, homeDir);
  const report = await createProjectDataService().selectAssetFile({
    projectName: record.projectRef.name,
    homeDir,
    target: { kind: 'castCostume', id: action.costumeId },
    assetFileId: action.assetFileId,
  });
  await notifyPanelProjectWrite({ projectRef: record.projectRef, resourceKeys: report.resourceKeys, tool: 'casting.board.act', homeDir });
  context.state.touch(record.sessionId);
  return null;
}

/** Sends the costume's kept sheets and the notes so the agent can open its next sheet round with them as references. */
export async function requestMoreSheetsLikeKept(context: CastingBoardActionContext, request: { kind: 'moreLikeKept'; notes: string; costumeId?: string }): Promise<string> {
  const { record, homeDir } = context;
  if (!request.costumeId) {
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', 'Name the costume whose sheets the next round should follow.');
  }
  const costume = await requireBoardCostume(record, request.costumeId, homeDir);
  const referenceAssetFileIds = keptImageIds(costume.rounds, costume.characterSheetAssetFileId);
  if (referenceAssetFileIds.length === 0) {
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', `${costume.name} has no kept sheets. Show one again first.`);
  }
  assertBoardIdle(record);
  return startBoardRequest(context.state, record.sessionId, {
    kind: 'moreLikeKept',
    subject: { kind: 'castCostume', id: costume.id },
    referenceAssetFileIds,
    notes: request.notes.trim(),
  });
}

async function requireBoardCostume(record: CastingBoardSessionRecord, costumeId: string, homeDir?: string) {
  const { resource, look } = await readSheetBoardLook(record, sheetSubject(record), homeDir);
  const costume = lookCostumes(resource, look.id).find((candidate) => candidate.id === costumeId);
  if (!costume) {
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', `Costume ${costumeId} is not on this board.`);
  }
  return costume;
}

function sheetSubject(record: CastingBoardSessionRecord): Extract<CastingBoardSubject, { mode: 'sheets' }> {
  const subject = boardSubject(record, 'sheets');
  if (!subject) throw castingBoardError('CODEX_CASTING_BOARD_INVALID', 'This action belongs to a sheets board.');
  return subject;
}
