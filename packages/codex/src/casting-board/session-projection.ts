import { projectCandidateBoard } from './candidate-board.js';
import type { CastingBoard, CastingBoardMode } from './contracts.js';
import { projectSheetBoard } from './sheet-board.js';
import type { CastingBoardSessionRecord, CastingBoardState, CastingBoardSubject } from './session-state.js';

type SubjectOf<M extends CastingBoardMode> = Extract<CastingBoardSubject, { mode: M }>;
type BoardProjection<M extends CastingBoardMode> = (record: CastingBoardSessionRecord, subject: SubjectOf<M>, homeDir?: string) => Promise<CastingBoard>;

/** Each board mode has one focused projection. */
const BOARD_PROJECTIONS: { [M in CastingBoardMode]: BoardProjection<M> } = {
  candidates: projectCandidateBoard,
  sheets: projectSheetBoard,
};

export function projectCastingBoard(record: CastingBoardSessionRecord, homeDir?: string): Promise<CastingBoard> {
  return projectSubject(record, record.subject, homeDir);
}

export function readCastingBoard(state: CastingBoardState, sessionId: string, homeDir?: string): Promise<CastingBoard> {
  return projectCastingBoard(state.record(sessionId), homeDir);
}

/** Narrows a subject to the mode it names; the subject must belong to the board record. */
export function boardSubject<M extends CastingBoardMode>(record: CastingBoardSessionRecord, mode: M): SubjectOf<M> | null {
  return record.subject.mode === mode ? record.subject as SubjectOf<M> : null;
}

function projectSubject<M extends CastingBoardMode>(record: CastingBoardSessionRecord, subject: SubjectOf<M>, homeDir?: string): Promise<CastingBoard> {
  return (BOARD_PROJECTIONS[subject.mode as M] as BoardProjection<M>)(record, subject, homeDir);
}
