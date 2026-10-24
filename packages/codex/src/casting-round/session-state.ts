import type { StudioProjectRef } from '@gorenku/studio-core/server';
import { PanelAnswerStore, type PanelAnswerRecord } from '../panel-sessions/answer-store.js';
import type { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { CastingRound, CastingRoundAnswer } from './contracts.js';
import { castingRoundError } from './diagnostics.js';

export const CASTING_ROUND_SCHEME = 'renku-casting-round';

export type CastingRoundView = Omit<CastingRound, 'revision' | 'answer'>;

export interface CastingRoundContext {
  projectRef: StudioProjectRef;
  media: PanelMediaRegistry;
}

export type CastingRoundRecord = PanelAnswerRecord<CastingRoundView, CastingRoundAnswer, CastingRoundContext>;

export class CastingRoundState extends PanelAnswerStore<CastingRoundView, CastingRoundAnswer, CastingRoundContext> {
  constructor() {
    super({
      notFound: () => castingRoundError('CODEX_CASTING_ROUND_NOT_FOUND', 'This Casting round panel does not exist in this connection.', 'Ask the agent to open the Casting round panel again.'),
      alreadyAnswered: () => castingRoundError('CODEX_CASTING_ROUND_INVALID', 'This Casting round panel was already answered.'),
      notAnswered: () => castingRoundError('CODEX_CASTING_ROUND_INVALID', 'The user has not answered the Casting round panel yet.', 'End the turn and wait for the Casting round message.'),
    });
  }
}
