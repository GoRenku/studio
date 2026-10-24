import { createProjectDataService } from '@gorenku/studio-core/server';
import { notifyPanelProjectWrite } from '../panel-sessions/project-notifications.js';
import { assertBoardIdle, startBoardRequest } from './board-requests.js';
import { castingBoardError } from './diagnostics.js';
import { boardSubject } from './session-projection.js';
import { readSheetBoardResource } from './sheet-board.js';
import type { CastingBoardActionContext, CastingBoardSessionRecord, CastingBoardSubject } from './session-state.js';

/** Picks the sheet for the costume through Core; it posts no message. */
export async function pickBoardSheet(context: CastingBoardActionContext, action: { kind: 'pickSheet'; costumeId: string; assetFileId: string }): Promise<null> {
  const { record, homeDir } = context;
  const resource = await readSheetBoardResource(record, sheetSubject(record), homeDir);
  if (!resource.costumes.some((costume) => costume.id === action.costumeId)) {
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', `Costume ${action.costumeId} is not on this board.`);
  }
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

/** Sends the current picks so the agent can continue with the sheets. */
export async function requestSheetPicksDone(context: CastingBoardActionContext): Promise<string> {
  const { record, homeDir } = context;
  const resource = await readSheetBoardResource(record, sheetSubject(record), homeDir);
  assertBoardIdle(record);
  const picks = resource.costumes.flatMap((costume) => costume.characterSheetAssetFileId
    ? [{ costumeId: costume.id, assetFileId: costume.characterSheetAssetFileId }]
    : []);
  return startBoardRequest(context.state, record.sessionId, { kind: 'sheetPicksDone', picks });
}

function sheetSubject(record: CastingBoardSessionRecord): Extract<CastingBoardSubject, { mode: 'sheets' }> {
  const subject = boardSubject(record, 'sheets');
  if (!subject) throw castingBoardError('CODEX_CASTING_BOARD_INVALID', 'This action belongs to a sheets board.');
  return subject;
}
