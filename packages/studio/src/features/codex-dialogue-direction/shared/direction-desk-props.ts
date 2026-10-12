import type { DialogueDirectionSession } from '@gorenku/studio-codex/dialogue-direction';
import type { PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import type { DialogueDirectionSessionInteraction } from './use-dialogue-direction-session';

/** What the panel hands the desk chosen by the route's script layout. */
export interface DirectionDeskProps {
  session: DialogueDirectionSession;
  interaction: DialogueDirectionSessionInteraction;
  media: PanelMediaLibrary;
}
