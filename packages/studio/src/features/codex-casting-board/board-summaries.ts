import type {
  CastingBoard,
  CastingBoardCandidate,
  CastingBoardRound,
  CastingCandidateBoard,
  CastingSheetBoard,
} from '@gorenku/studio-codex/casting-board';
import type { CastingBoardRequestReceipt } from '@/services/codex-casting-board';

export type CandidateTab = 'all' | 'shortlist' | 'hidden';

/** A candidate with the round it came from. */
export interface BoardCandidate extends CastingBoardCandidate {
  roundNumber: number;
}

const TAB_FILTERS: Record<CandidateTab, (candidate: CastingBoardCandidate) => boolean> = {
  all: () => true,
  shortlist: (candidate) => candidate.status === 'shortlisted',
  hidden: (candidate) => candidate.status === 'hidden',
};

export function boardCandidates(board: CastingCandidateBoard): BoardCandidate[] {
  return board.rounds.flatMap((round) => round.candidates.map((candidate) => ({ ...candidate, roundNumber: round.number })));
}

export function tabCandidates(candidates: CastingBoardCandidate[], tab: CandidateTab): CastingBoardCandidate[] {
  return candidates.filter(TAB_FILTERS[tab]);
}

export function pendingTotal(round: CastingBoardRound): number {
  return round.pending.reduce((total, entry) => total + entry.count, 0);
}

/** Every candidate plus the ones still being generated. */
export function tabCounts(board: CastingCandidateBoard): Record<CandidateTab, number> {
  const candidates = boardCandidates(board);
  return {
    all: candidates.length + board.rounds.reduce((total, round) => total + pendingTotal(round), 0),
    shortlist: tabCandidates(candidates, 'shortlist').length,
    hidden: tabCandidates(candidates, 'hidden').length,
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
  return `More candidates requested · ${subject} · ${tabCandidates(boardCandidates(board), 'shortlist').length} shortlisted`;
}

function sheetRequestSummary(board: CastingSheetBoard): string {
  const picked = board.costumes.filter((costume) => costume.pickedAssetFileId).length;
  return `Sheet picks sent · ${board.castMember.name} · ${picked} of ${board.costumes.length} costumes picked`;
}
