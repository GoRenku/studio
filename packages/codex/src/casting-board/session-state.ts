import type { StudioProjectRef } from '@gorenku/studio-core/server';
import type { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import { PanelSessionStore, type PanelSessionRecord } from '../panel-sessions/session-store.js';
import type { CastingBoardRequest, CastingBoardRequestKind } from './contracts.js';
import { castingBoardError } from './diagnostics.js';

export const CASTING_BOARD_SCHEME = 'renku-casting-board';

export type CastingBoardSubject =
  | { mode: 'candidates'; castMemberId: string; lookId: string }
  | { mode: 'sheets'; castMemberId: string };

export interface CastingBoardSessionParts {
  projectRef: StudioProjectRef;
  subject: CastingBoardSubject;
  media: PanelMediaRegistry;
}

type CastingBoardActionDetails = { kind: CastingBoardRequestKind };
type CastingBoardCompletion = { actionId: string; kind: CastingBoardRequestKind };

export type CastingBoardSessionRecord = PanelSessionRecord<CastingBoardSessionParts, CastingBoardActionDetails, CastingBoardCompletion>;

export interface CastingBoardActionContext {
  state: CastingBoardState;
  record: CastingBoardSessionRecord;
  homeDir?: string;
}

/** One request waits for the agent at a time; consuming it completes it. */
export class CastingBoardState extends PanelSessionStore<CastingBoardSessionParts, CastingBoardRequest, CastingBoardActionDetails, CastingBoardCompletion> {
  constructor() {
    super({
      busy: () => castingBoardError('CODEX_CASTING_BOARD_BUSY', 'A request is already waiting for the agent on this board.', 'Wait for the agent to pick up the current request.'),
      sessionNotFound: () => castingBoardError('CODEX_CASTING_BOARD_NOT_FOUND', 'This casting board does not exist in this connection.', 'Ask the agent to open the casting board again.'),
      actionNotFound: () => castingBoardError('CODEX_CASTING_BOARD_NOT_FOUND', 'This casting board request does not exist.'),
      invalid: (message) => castingBoardError('CODEX_CASTING_BOARD_INVALID', message),
    });
  }
}
