import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DialogueDirectionDraft,
  DialogueDirectionGenerateReceipt,
  DialogueDirectionSession,
} from '@gorenku/studio-codex/dialogue-direction';
import type { CodexApp } from '@/services/codex-app';
import {
  connectDialogueDirectionApp,
  createDialogueDirectionApp,
  discardDialogueDirectionTake,
  generateDialogueDirectionTake,
  notifyDialogueDirectionGenerate,
  readDialogueDirectionSession,
  selectDialogueDirectionTake,
} from '@/services/codex-dialogue-direction';

const SESSION_POLL_INTERVAL_MS = 2000;

export function useDialogueDirectionSession(appName: string) {
  const [bridge, setBridge] = useState<CodexApp>();
  const [session, setSession] = useState<DialogueDirectionSession>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingNotification, setPendingNotification] = useState<DialogueDirectionGenerateReceipt>();
  const [autoPlayTakeId, setAutoPlayTakeId] = useState<string>();
  const latestSession = useRef<DialogueDirectionSession | undefined>(undefined);

  const applySession = useCallback((next: DialogueDirectionSession) => {
    const previous = latestSession.current;
    if (previous?.sessionId === next.sessionId) {
      if (next.revision < previous.revision) return;
      if (next.lastCompletedAction && next.lastCompletedAction.actionId !== previous.lastCompletedAction?.actionId) {
        setAutoPlayTakeId(next.lastCompletedAction.takeId);
      }
    } else {
      setAutoPlayTakeId(undefined);
    }
    latestSession.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let disposed = false;
    const app = createDialogueDirectionApp(appName);
    app.app.ontoolresult = (result) => {
      if (disposed) return;
      if (result.isError) { setError(resultError(result)); return; }
      const next = result.structuredContent?.session as DialogueDirectionSession | undefined;
      if (next) applySession(next);
    };
    app.app.onteardown = async () => { disposed = true; setBridge(undefined); return {}; };
    void connectDialogueDirectionApp(app).then(() => { if (!disposed) setBridge(app); }).catch((failure) => { if (!disposed) setError(errorMessage(failure)); });
    return () => { disposed = true; void app.app.close(); };
  }, [appName, applySession]);

  const sessionId = session?.sessionId;
  const actionActive = session?.action ? session.action.status !== 'failed' : false;

  useEffect(() => {
    if (!bridge || !sessionId) return;
    let disposed = false;
    let reading = false;
    const refresh = () => {
      if (disposed || reading || document.visibilityState === 'hidden') return;
      reading = true;
      const current = latestSession.current;
      void readDialogueDirectionSession(bridge, sessionId)
        .then((next) => { if (!disposed && latestSession.current === current && next.sessionId === sessionId) applySession(next); })
        .catch((failure) => { if (!disposed) setError(errorMessage(failure)); })
        .finally(() => { reading = false; });
    };
    const interval = setInterval(refresh, SESSION_POLL_INTERVAL_MS);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    refresh();
    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [applySession, bridge, sessionId]);

  const run = async (operation: (connected: CodexApp, current: DialogueDirectionSession) => Promise<void>) => {
    const current = latestSession.current;
    if (!bridge || !current || busy) return;
    setBusy(true);
    setError(undefined);
    try { await operation(bridge, current); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const generate = (draft: DialogueDirectionDraft) => run(async (connected, current) => {
    if (current.action && current.action.status !== 'failed') return;
    const receipt = await generateDialogueDirectionTake(connected, { sessionId: current.sessionId, draft });
    applySession(receipt.session);
    setAutoPlayTakeId(undefined);
    await notifyDialogueDirectionGenerate(connected, receipt).catch((failure) => {
      setPendingNotification(receipt);
      throw failure;
    });
    setPendingNotification(undefined);
  });

  const retryNotification = () => run(async (connected) => {
    if (!pendingNotification) return;
    await notifyDialogueDirectionGenerate(connected, pendingNotification);
    setPendingNotification(undefined);
  });

  const selectTake = (takeId: string, selected: boolean) => run(async (connected, current) => {
    applySession(await selectDialogueDirectionTake(connected, { sessionId: current.sessionId, takeId, selected }));
  });

  const discardTake = (takeId: string) => run(async (connected, current) => {
    applySession(await discardDialogueDirectionTake(connected, { sessionId: current.sessionId, takeId }));
  });

  return {
    bridge,
    session,
    connected: Boolean(bridge),
    busy,
    error,
    actionActive,
    autoPlayTakeId,
    notificationPending: Boolean(pendingNotification),
    generate,
    retryNotification,
    selectTake,
    discardTake,
  };
}

export type DialogueDirectionSessionInteraction = ReturnType<typeof useDialogueDirectionSession>;

function resultError(result: { content: Array<{ type: string; text?: string }>; structuredContent?: Record<string, unknown> }): string {
  const failure = result.structuredContent?.error as { message?: unknown } | undefined;
  if (failure && typeof failure.message === 'string') return failure.message;
  return result.content.find((content) => content.type === 'text')?.text ?? 'The dialogue direction could not be opened.';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The dialogue direction interaction failed.';
}
