import type {
  CastingBoard,
  CastingBoardActInput,
  CastingBoardReceipt,
  CastingBoardRequestInput,
} from '@gorenku/studio-codex/casting-board';
import type { CodexApp } from '@/services/codex-app';
import {
  callCodexPanelTool,
  connectCodexPanelApp,
  createCodexPanelApp,
  invalidPanelResponse,
  readCodexPanelResource,
  sendCodexPanelMessage,
  type CodexPanelFamily,
} from '@/services/codex-panel';

const CASTING_BOARD: CodexPanelFamily = {
  label: 'casting board',
  invalidCode: 'CODEX_CASTING_BOARD_INVALID',
  unsupportedCode: 'CODEX_CASTING_BOARD_INVALID',
};

/** A board request with its action id; the session hook posts its message. */
export type CastingBoardRequestReceipt = CastingBoardReceipt & { actionId: string };

export function createCastingBoardApp(name: string): CodexApp {
  return createCodexPanelApp(name, 'fullscreen');
}

export function connectCastingBoardApp(bridge: CodexApp): Promise<void> {
  return connectCodexPanelApp(bridge, 'fullscreen', CASTING_BOARD);
}

export function readCastingBoard(bridge: CodexApp, sessionId: string): Promise<CastingBoard> {
  return readCodexPanelResource<CastingBoard>(bridge, `renku-casting-board://${sessionId}`, CASTING_BOARD);
}

export async function actOnCastingBoard(bridge: CodexApp, input: CastingBoardActInput): Promise<CastingBoardReceipt> {
  return receiptFrom(await callCodexPanelTool(bridge, 'casting.board.act', { ...input }, CASTING_BOARD), 'casting.board.act');
}

/** Cast selects the candidate through Core and also waits for the agent, so it returns its action id. */
export async function castOnCastingBoard(bridge: CodexApp, input: { sessionId: string; assetFileId: string }): Promise<CastingBoardRequestReceipt> {
  const receipt = await actOnCastingBoard(bridge, { sessionId: input.sessionId, action: { kind: 'cast', assetFileId: input.assetFileId } });
  if (!receipt.actionId) throw invalidPanelResponse('casting.board.act', CASTING_BOARD);
  return receipt as CastingBoardRequestReceipt;
}

export async function requestFromCastingBoard(bridge: CodexApp, input: CastingBoardRequestInput): Promise<CastingBoardRequestReceipt> {
  const receipt = receiptFrom(await callCodexPanelTool(bridge, 'casting.board.request', { ...input }, CASTING_BOARD), 'casting.board.request');
  if (!receipt.actionId) throw invalidPanelResponse('casting.board.request', CASTING_BOARD);
  return receipt as CastingBoardRequestReceipt;
}

/** A neutral notice naming the board and what the user sent; it carries no approval. */
export function notifyCastingBoardRequest(bridge: CodexApp, receipt: CastingBoardRequestReceipt, summary: string): Promise<void> {
  return sendCodexPanelMessage(bridge, `${summary}. Board ${receipt.sessionId}. Consume it with casting.board.consume once.`, CASTING_BOARD);
}

function receiptFrom(result: Record<string, unknown>, source: string): CastingBoardReceipt {
  const receipt = result as Partial<CastingBoardReceipt>;
  if (!receipt.sessionId || !receipt.session) throw invalidPanelResponse(source, CASTING_BOARD);
  return receipt as CastingBoardReceipt;
}
