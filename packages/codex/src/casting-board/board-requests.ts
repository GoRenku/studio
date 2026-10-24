import type { CastingBoardConsumeResult, CastingBoardRequest } from './contracts.js';
import { castingBoardError } from './diagnostics.js';
import type { CastingBoardSessionRecord, CastingBoardState } from './session-state.js';

/** Checked before a request's Core write so a busy board never writes half an action. */
export function assertBoardIdle(record: CastingBoardSessionRecord): void {
  if (record.action && record.action.status !== 'failed') {
    throw castingBoardError('CODEX_CASTING_BOARD_BUSY', 'A request is already waiting for the agent on this board.', 'Wait for the agent to pick up the current request.');
  }
}

export function startBoardRequest(state: CastingBoardState, sessionId: string, request: CastingBoardRequest): string {
  return state.startAction(sessionId, request, { kind: request.kind }).actionId;
}

/** Returns the waiting request once and completes it; alreadyConsumed when the latest one was taken. */
export function consumeCastingBoardRequest(state: CastingBoardState, sessionId: string): CastingBoardConsumeResult {
  const record = state.record(sessionId);
  if (record.action?.status !== 'pending') {
    if (record.lastCompletedAction) return { status: 'alreadyConsumed', sessionId };
    throw castingBoardError('CODEX_CASTING_BOARD_INVALID', 'The user has not sent a request from this board yet.', 'End the turn and wait for the casting board message.');
  }
  const { actionId } = record.action;
  const request = state.consume(sessionId, actionId)!;
  state.completeAction(sessionId, actionId, { actionId, kind: request.kind });
  return { status: 'consumed', sessionId, request };
}
