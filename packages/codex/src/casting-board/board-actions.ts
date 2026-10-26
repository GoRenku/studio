import type {
  CastingBoardActAction,
  CastingBoardActInput,
  CastingBoardReceipt,
  CastingBoardRequestAction,
  CastingBoardRequestInput,
} from './contracts.js';
import { castBoardCandidate, requestMoreCandidatesLikeKept, setBoardCandidateStatus } from './candidate-actions.js';
import type { CastingBoardMode } from './contracts.js';
import { readCastingBoard } from './session-projection.js';
import type { CastingBoardActionContext, CastingBoardState } from './session-state.js';
import { pickBoardSheet, requestMoreSheetsLikeKept } from './sheet-actions.js';

/** Each handler returns the action id when the user's step also waits for the agent. */
type BoardHandlers<TAction extends { kind: string }> = {
  [K in TAction['kind']]: (context: CastingBoardActionContext, action: Extract<TAction, { kind: K }>) => Promise<string | null>;
};

const ACT_HANDLERS: BoardHandlers<CastingBoardActAction> = {
  hide: setBoardCandidateStatus,
  restore: setBoardCandidateStatus,
  cast: castBoardCandidate,
  pickSheet: pickBoardSheet,
};

const MORE_LIKE_KEPT: Record<CastingBoardMode, (context: CastingBoardActionContext, request: CastingBoardRequestAction) => Promise<string>> = {
  candidates: requestMoreCandidatesLikeKept,
  sheets: requestMoreSheetsLikeKept,
};

const REQUEST_HANDLERS: BoardHandlers<CastingBoardRequestAction> = {
  moreLikeKept: (context, request) => MORE_LIKE_KEPT[context.record.subject.mode](context, request),
};

export function actOnCastingBoard(state: CastingBoardState, input: CastingBoardActInput, homeDir?: string): Promise<CastingBoardReceipt> {
  const handler = ACT_HANDLERS[input.action.kind] as (context: CastingBoardActionContext, action: CastingBoardActAction) => Promise<string | null>;
  return runBoardHandler(state, input.sessionId, homeDir, (context) => handler(context, input.action));
}

export function requestFromCastingBoard(state: CastingBoardState, input: CastingBoardRequestInput, homeDir?: string): Promise<CastingBoardReceipt> {
  const handler = REQUEST_HANDLERS[input.request.kind] as (context: CastingBoardActionContext, request: CastingBoardRequestAction) => Promise<string | null>;
  return runBoardHandler(state, input.sessionId, homeDir, (context) => handler(context, input.request));
}

async function runBoardHandler(
  state: CastingBoardState,
  sessionId: string,
  homeDir: string | undefined,
  run: (context: CastingBoardActionContext) => Promise<string | null>,
): Promise<CastingBoardReceipt> {
  const actionId = await run({ state, record: state.record(sessionId), homeDir });
  return { sessionId, actionId, session: await readCastingBoard(state, sessionId, homeDir) };
}
