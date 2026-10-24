/**
 * Type-only contracts shared by the Codex casting board runtime and the Studio casting board app.
 * This file is the `@gorenku/studio-codex/casting-board` package export; keep it free of runtime code.
 */
import type {
  CastCastingResource,
  CastingCandidateStatus,
  CastingEstimatedCost,
  CastingRoute,
  GenerationLaneModel,
} from '@gorenku/studio-core/client';

export type CastingBoardMode = 'candidates' | 'sheets';

/** A request the user sends to the agent from the board; the agent consumes the latest one once. */
export type CastingBoardRequest =
  | { kind: 'moreLikeShortlist'; lookId: string; shortlistedAssetFileIds: string[]; notes: string }
  | { kind: 'cast'; lookId: string; assetFileId: string }
  | { kind: 'sheetPicksDone'; picks: Array<{ costumeId: string; assetFileId: string }> };

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

export interface CastingSheetBoard extends CastingBoardBase {
  mode: 'sheets';
  scenes: CastCastingResource['scenes'];
  looks: Array<{ id: string; name: string; castImageUri: string | null }>;
  costumes: Array<{ id: string; name: string; lookId: string; sceneIds: string[]; pickedAssetFileId: string | null }>;
  /** Every active Character Sheet of the Cast Member; any of them can be picked for a costume. */
  sheets: Array<{ assetFileId: string; imageUri: string }>;
}

export type CastingBoard = CastingCandidateBoard | CastingSheetBoard;

export type CastingBoardOpenInput =
  | { project: string; mode: 'candidates'; lookId: string }
  | { project: string; mode: 'sheets'; castMemberId: string };

/** Durable board actions, written through Core; only cast also waits for the agent. */
export type CastingBoardActAction =
  | { kind: 'shortlist'; assetFileId: string }
  | { kind: 'hide'; assetFileId: string }
  | { kind: 'restore'; assetFileId: string }
  | { kind: 'cast'; assetFileId: string }
  | { kind: 'pickSheet'; costumeId: string; assetFileId: string };

export type CastingBoardActKind = CastingBoardActAction['kind'];

export interface CastingBoardActInput {
  sessionId: string;
  action: CastingBoardActAction;
}

export type CastingBoardRequestAction = { kind: 'moreLikeShortlist'; notes: string } | { kind: 'sheetPicksDone' };

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
