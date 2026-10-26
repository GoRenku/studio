/**
 * Type-only contracts shared by the Codex casting board runtime and the Studio casting board app.
 * This file is the `@gorenku/studio-codex/casting-board` package export; keep it free of runtime code.
 */
import type {
  CastCastingResource,
  CastingCandidateStatus,
  CastingEstimatedCost,
  CastingRoundSubject,
  CastingRoute,
  GenerationLaneModel,
} from '@gorenku/studio-core/client';

export type CastingBoardMode = 'candidates' | 'sheets';

/**
 * A request the user sends to the agent from the board; the agent consumes the latest one once.
 * moreLikeKept names the Look or costume whose next round should use the kept images as references.
 */
export type CastingBoardRequest =
  | { kind: 'moreLikeKept'; subject: CastingRoundSubject; referenceAssetFileIds: string[]; notes: string }
  | { kind: 'cast'; lookId: string; assetFileId: string };

export type CastingBoardRequestKind = CastingBoardRequest['kind'];

export interface CastingBoardAction {
  actionId: string;
  kind: CastingBoardRequestKind;
  status: 'pending' | 'running' | 'failed';
  message?: string;
}

interface CastingBoardBase {
  sessionId: string;
  revision: number;
  castMember: { id: string; name: string };
  /** The request waiting for the agent; null once consumed. */
  action: CastingBoardAction | null;
  lastCompletedAction: { actionId: string; kind: CastingBoardRequestKind } | null;
}

export interface CastingBoardCandidate {
  assetFileId: string;
  status: CastingCandidateStatus;
  /** The round route model that generated the candidate. */
  model: GenerationLaneModel;
  imageUri: string;
}

export interface CastingBoardRound {
  id: string;
  number: number;
  routes: CastingRoute[];
  estimatedCost: CastingEstimatedCost | null;
  expectedCount: number;
  /** Candidates still being generated per model: the route counts minus the imported candidates. */
  pending: Array<{ model: GenerationLaneModel; count: number }>;
  candidates: CastingBoardCandidate[];
}

export interface CastingCandidateBoard extends CastingBoardBase {
  mode: 'candidates';
  look: { id: string; name: string; castAssetFileId: string | null };
  /** Newest first. */
  rounds: CastingBoardRound[];
}

/** One costume of the board's Look with its character sheet rounds, newest first. */
export interface CastingSheetBoardCostume {
  id: string;
  name: string;
  sceneIds: string[];
  pickedAssetFileId: string | null;
  rounds: CastingBoardRound[];
}

export interface CastingSheetBoard extends CastingBoardBase {
  mode: 'sheets';
  look: { id: string; name: string };
  scenes: CastCastingResource['scenes'];
  /** The costume the board opens on when the agent named one. */
  focusCostumeId: string | null;
  costumes: CastingSheetBoardCostume[];
}

export type CastingBoard = CastingCandidateBoard | CastingSheetBoard;

export type CastingBoardOpenInput =
  | { project: string; mode: 'candidates'; lookId: string }
  | { project: string; mode: 'sheets'; lookId: string; costumeId?: string };

/** Durable board actions, written through Core; only cast also waits for the agent. */
export type CastingBoardActAction =
  | { kind: 'hide'; assetFileId: string }
  | { kind: 'restore'; assetFileId: string }
  | { kind: 'cast'; assetFileId: string }
  | { kind: 'pickSheet'; costumeId: string; assetFileId: string };

export type CastingBoardActKind = CastingBoardActAction['kind'];

export interface CastingBoardActInput {
  sessionId: string;
  action: CastingBoardActAction;
}

/** On a sheets board, moreLikeKept names the costume shown. */
export type CastingBoardRequestAction = { kind: 'moreLikeKept'; notes: string; costumeId?: string };

export interface CastingBoardRequestInput {
  sessionId: string;
  request: CastingBoardRequestAction;
}

/** Act results and requests carry the re-read board; a request also names its action. */
export interface CastingBoardReceipt {
  sessionId: string;
  actionId: string | null;
  session: CastingBoard;
}

export interface CastingBoardConsumeInput {
  sessionId: string;
}

export type CastingBoardConsumeResult =
  | { status: 'consumed'; sessionId: string; request: CastingBoardRequest }
  | { status: 'alreadyConsumed'; sessionId: string };
