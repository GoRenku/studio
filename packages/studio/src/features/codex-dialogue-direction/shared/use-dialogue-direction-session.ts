import { useRef } from 'react';
import type {
  DialogueDirectionDraft,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionSession,
} from '@gorenku/studio-codex/dialogue-direction';
import { useCodexPanelSession } from '@/features/codex-panels/use-codex-panel-session';
import {
  connectDialogueDirectionApp,
  createDialogueDirectionApp,
  discardDialogueDirectionTake,
  generateDialogueDirectionTake,
  notifyDialogueDirectionGenerate,
  readDialogueDirectionSession,
  selectDialogueDirectionTake,
} from '@/services/codex-dialogue-direction';

const FAILURES = { opening: 'The dialogue direction could not be opened.', interaction: 'The dialogue direction interaction failed.' };

export function useDialogueDirectionSession(appName: string) {
  // The approval shown beside Generate when it was clicked; a retried notification repeats it.
  const approval = useRef('');
  const panel = useCodexPanelSession<DialogueDirectionSession, DialogueDirectionGenerateReceipt>({
    appName,
    create: createDialogueDirectionApp,
    connect: connectDialogueDirectionApp,
    read: readDialogueDirectionSession,
    notify: (bridge, receipt) => notifyDialogueDirectionGenerate(bridge, receipt, approval.current),
    failures: FAILURES,
  });

  const generate = (draft: DialogueDirectionDraft, approvalText: string) => {
    approval.current = approvalText;
    return panel.generate((connected, current) => generateDialogueDirectionTake(connected, { sessionId: current.sessionId, draft }));
  };

  const selectTake = (takeId: string, selected: boolean) => panel.run(async (connected, current) => {
    panel.applySession(await selectDialogueDirectionTake(connected, { sessionId: current.sessionId, takeId, selected }));
  });

  const discardTake = (takeId: string) => panel.run(async (connected, current) => {
    panel.applySession(await discardDialogueDirectionTake(connected, { sessionId: current.sessionId, takeId }));
  });

  return {
    bridge: panel.bridge,
    session: panel.session,
    connected: panel.connected,
    busy: panel.busy,
    error: panel.error,
    actionActive: panel.actionActive,
    autoPlayTakeId: panel.newCompletion?.takeId,
    notificationPending: panel.notificationPending,
    generate,
    retryNotification: panel.retryNotification,
    selectTake,
    discardTake,
  };
}

export type DialogueDirectionSessionInteraction = ReturnType<typeof useDialogueDirectionSession>;
