import type { StudioProjectRef } from '@gorenku/studio-core/server';
import type { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import { PanelSessionStore, type PanelSessionRecord } from '../panel-sessions/session-store.js';
import type {
  DialogueDirectionDraft,
  DialogueDirectionLine,
  DialogueDirectionRoute,
  DialogueDirectionSession,
  DialogueDirectionVoice,
  DialogueLineRange,
} from './contracts.js';
import { directionError } from './diagnostics.js';

export const DIALOGUE_DIRECTION_MEDIA_SCHEME = 'renku-direction';

export interface DialogueDirectionBinding {
  projectRef: StudioProjectRef;
  shotPlanId: string;
}

export interface DialogueDirectionSessionParts {
  binding: DialogueDirectionBinding;
  route: DialogueDirectionRoute;
  shotPlan: { id: string; title: string; sceneHeading: string };
  lines: DialogueDirectionLine[];
  voices: Record<string, DialogueDirectionVoice[]>;
  initial: DialogueDirectionSession['initial'];
  media: PanelMediaRegistry;
}

type DialogueDirectionActionDetails = { turnRange: DialogueLineRange };
type DialogueDirectionCompletion = NonNullable<DialogueDirectionSession['lastCompletedAction']>;

export type DialogueDirectionSessionRecord = PanelSessionRecord<DialogueDirectionSessionParts, DialogueDirectionActionDetails, DialogueDirectionCompletion>;

export class DialogueDirectionState extends PanelSessionStore<DialogueDirectionSessionParts, DialogueDirectionDraft, DialogueDirectionActionDetails, DialogueDirectionCompletion> {
  constructor() {
    super({
      busy: () => directionError('CODEX_DIALOGUE_DIRECTION_BUSY', 'A Generate action is already outstanding for this panel.', 'Wait for the agent to report the current action before generating again.'),
      sessionNotFound: () => directionError('CODEX_DIALOGUE_DIRECTION_NOT_FOUND', 'This dialogue direction session does not exist in this connection.', 'Open a fresh dialogue direction panel.'),
      actionNotFound: () => directionError('CODEX_DIALOGUE_DIRECTION_NOT_FOUND', 'This dialogue direction action does not exist in this session.'),
      invalid: (message) => directionError('CODEX_DIALOGUE_DIRECTION_INVALID', message),
    });
  }
}
