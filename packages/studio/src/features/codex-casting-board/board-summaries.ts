import type {
  CastingBoard,
  CastingBoardCandidate,
  CastingBoardRound,
  CastingCandidateBoard,
  CastingSheetBoard,
} from '@gorenku/studio-codex/casting-board';
import type { CastingBoardRequestReceipt } from '@/services/codex-casting-board';

export type CandidateTab = 'kept' | 'hidden';

/** A candidate or sheet with the round it came from. */
export interface BoardCandidate extends CastingBoardCandidate {
  roundNumber: number;
}

/** A kept image is one that isn't hidden; the round's choice always counts as kept. */
export function isKeptCandidate(candidate: CastingBoardCandidate, chosenAssetFileId: string | null): boolean {
  return candidate.status !== 'hidden' || candidate.assetFileId === chosenAssetFileId;
}

const TAB_FILTERS: Record<CandidateTab, (candidate: CastingBoardCandidate, chosenAssetFileId: string | null) => boolean> = {
  kept: isKeptCandidate,
  hidden: (candidate, chosenAssetFileId) => !isKeptCandidate(candidate, chosenAssetFileId),
};

export function boardCandidates(rounds: CastingBoardRound[]): BoardCandidate[] {
  return rounds.flatMap((round) => round.candidates.map((candidate) => ({ ...candidate, roundNumber: round.number })));
}

export function tabCandidates<T extends CastingBoardCandidate>(candidates: T[], tab: CandidateTab, chosenAssetFileId: string | null): T[] {
  return candidates.filter((candidate) => TAB_FILTERS[tab](candidate, chosenAssetFileId));
}

export function pendingTotal(round: CastingBoardRound): number {
  return round.pending.reduce((total, entry) => total + entry.count, 0);
}

/** Kept images plus the ones still being generated, and the hidden ones. */
export function tabCounts(rounds: CastingBoardRound[], chosenAssetFileId: string | null): Record<CandidateTab, number> {
  const candidates = boardCandidates(rounds);
  return {
    kept: tabCandidates(candidates, 'kept', chosenAssetFileId).length + rounds.reduce((total, round) => total + pendingTotal(round), 0),
    hidden: tabCandidates(candidates, 'hidden', chosenAssetFileId).length,
  };
}

/** "Model A ×4 · Model B ×3 · $0.67" */
export function roundRoutesLine(round: CastingBoardRound): string {
  const routes = round.routes.map((route) => `${route.model.name} ×${route.count}`);
  return [...routes, ...(round.estimatedCost ? [formatCost(round.estimatedCost)] : [])].join(' · ');
}

export function formatCost(cost: { amount: number; currency: string }): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency }).format(cost.amount);
}

type BoardSummaries = { [K in CastingBoardRequestReceipt['session']['mode']]: (board: Extract<CastingBoard, { mode: K }>, kind: string) => string };

const REQUEST_SUMMARIES: BoardSummaries = {
  candidates: candidateRequestSummary,
  sheets: sheetRequestSummary,
};

/** The first part of the board's neutral conversation notice; the service adds the board id. */
export function boardRequestSummary(receipt: CastingBoardRequestReceipt): string {
  const board = receipt.session;
  const kind = board.action?.kind ?? board.lastCompletedAction?.kind ?? '';
  return (REQUEST_SUMMARIES[board.mode] as (board: CastingBoard, kind: string) => string)(board, kind);
}

function candidateRequestSummary(board: CastingCandidateBoard, kind: string): string {
  const subject = `${board.castMember.name} · ${board.look.name}`;
  const candidates = boardCandidates(board.rounds);
  if (kind === 'cast') {
    const cast = candidates.find((candidate) => candidate.assetFileId === board.look.castAssetFileId);
    return cast ? `Look cast · ${subject} · candidate from round ${cast.roundNumber} (${cast.model.name})` : `Look cast · ${subject}`;
  }
  return `More candidates requested · ${subject} · like ${tabCandidates(candidates, 'kept', board.look.castAssetFileId).length} kept`;
}

function sheetRequestSummary(board: CastingSheetBoard): string {
  return `More character sheets requested · ${board.castMember.name} · ${board.look.name}`;
}
