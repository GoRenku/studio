import type { StudioProjectRef } from '@gorenku/studio-core/server';
import { PanelAnswerStore, type PanelAnswerRecord } from '../panel-sessions/answer-store.js';
import type { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { CastingWardrobeAnswer, CastingWardrobePanel } from './contracts.js';
import { castingWardrobeError } from './diagnostics.js';

export const CASTING_WARDROBE_SCHEME = 'renku-casting-wardrobe';

type WithoutAnswer<P> = P extends unknown ? Omit<P, 'revision' | 'answer'> : never;

export type CastingWardrobeView = WithoutAnswer<CastingWardrobePanel>;

export interface CastingWardrobeContext {
  projectRef: StudioProjectRef;
  media: PanelMediaRegistry;
}

export type CastingWardrobeRecord = PanelAnswerRecord<CastingWardrobeView, CastingWardrobeAnswer, CastingWardrobeContext>;

export class CastingWardrobeState extends PanelAnswerStore<CastingWardrobeView, CastingWardrobeAnswer, CastingWardrobeContext> {
  constructor() {
    super({
      notFound: () => castingWardrobeError('CODEX_CASTING_WARDROBE_NOT_FOUND', 'This Looks and wardrobe panel does not exist in this connection.', 'Ask the agent to open the panel again.'),
      alreadyAnswered: () => castingWardrobeError('CODEX_CASTING_WARDROBE_INVALID', 'This Looks and wardrobe panel was already answered.'),
      notAnswered: () => castingWardrobeError('CODEX_CASTING_WARDROBE_INVALID', 'The user has not sent the plan yet.', 'End the turn and wait for the panel message.'),
    });
  }
}
