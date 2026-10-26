import type {
  CastingBoard,
  CastingBoardCandidate,
  CastingBoardRound,
  CastingCandidateBoard,
  CastingSheetBoard,
} from '@gorenku/studio-codex/casting-board';
import type { CastingBoardRequestReceipt } from '@/services/codex-casting-board';

export type CandidateTab = 'candidates' | 'hidden';

/** A candidate with the round it came from. */
export interface BoardCandidate extends CastingBoardCandidate {
  roundNumber: number;
}

/** A kept candidate is one that isn't hidden; the cast candidate always counts as kept. */
export function isKeptCandidate(candidate: CastingBoardCandidate, castAssetFileId: string | null): boolean {
  return candidate.status !== 'hidden' || candidate.assetFileId === castAssetFileId;
}

const TAB_FILTERS: Record<CandidateTab, (candidate: CastingBoardCandidate, castAssetFileId: string | null) => boolean> = {
  candidates: isKeptCandidate,
  hidden: (candidate, castAssetFileId) => !isKeptCandidate(candidate, castAssetFileId),
};

export function boardCandidates(board: CastingCandidateBoard): BoardCandidate[] {
  return board.rounds.flatMap((round) => round.candidates.map((candidate) => ({ ...candidate, roundNumber: round.number })));
}

export function tabCandidates<T extends CastingBoardCandidate>(candidates: T[], tab: CandidateTab, castAssetFileId: string | null): T[] {
  return candidates.filter((candidate) => TAB_FILTERS[tab](candidate, castAssetFileId));
}

export function pendingTotal(round: CastingBoardRound): number {
  return round.pending.reduce((total, entry) => total + entry.count, 0);
}

/** Kept candidates plus the ones still being generated, and the hidden ones. */
export function tabCounts(board: CastingCandidateBoard): Record<CandidateTab, number> {
  const candidates = boardCandidates(board);
  const castAssetFileId = board.look.castAssetFileId;
  return {
    candidates: tabCandidates(candidates, 'candidates', castAssetFileId).length + board.rounds.reduce((total, round) => total + pendingTotal(round), 0),
    hidden: tabCandidates(candidates, 'hidden', castAssetFileId).length,
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
  if (kind === 'cast') {
    const cast = boardCandidates(board).find((candidate) => candidate.assetFileId === board.look.castAssetFileId);
    return cast ? `Look cast · ${subject} · candidate from round ${cast.roundNumber} (${cast.model.name})` : `Look cast · ${subject}`;
  }
  return `More candidates requested · ${subject} · like ${tabCandidates(boardCandidates(board), 'candidates', board.look.castAssetFileId).length} kept`;
}

function sheetRequestSummary(board: CastingSheetBoard): string {
  const picked = board.costumes.filter((costume) => costume.pickedAssetFileId).length;
  return `Sheet picks sent · ${board.castMember.name} · ${picked} of ${board.costumes.length} costumes picked`;
}
