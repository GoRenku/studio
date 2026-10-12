import type { JSX } from 'react';
import type { DialogueDirectionScriptLayout } from '@gorenku/studio-codex/dialogue-direction';
import { CodexPanelPending } from '@/features/codex-panels/codex-panel-notice';
import { usePanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { LineScriptsDesk } from './line-scripts/line-scripts-desk';
import { RangePromptDesk } from './range-prompt/range-prompt-desk';
import type { DirectionDeskProps } from './shared/direction-desk-props';
import { useDialogueDirectionSession } from './shared/use-dialogue-direction-session';

const DIRECTION_DESKS: Record<DialogueDirectionScriptLayout, (props: DirectionDeskProps) => JSX.Element> = {
  'line-scripts': LineScriptsDesk,
  'range-prompt': RangePromptDesk,
};

/** The one dialogue direction panel; the route's script layout picks the desk. */
export function DialogueDirectionPanel() {
  const interaction = useDialogueDirectionSession('Renku dialogue direction');
  const media = usePanelMediaLibrary(interaction.bridge);
  const { session } = interaction;
  if (!session) return <CodexPanelPending error={interaction.error} label='dialogue direction' themeClass='dialogue-direction' />;
  const Desk = DIRECTION_DESKS[session.route.scriptLayout];
  return <Desk key={session.sessionId} session={session} interaction={interaction} media={media} />;
}
