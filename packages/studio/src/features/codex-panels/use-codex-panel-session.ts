import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodexApp } from '@/services/codex-app';

const SESSION_POLL_INTERVAL_MS = 2000;

/** The lifecycle fields every Codex panel session shares. */
export interface CodexPanelSession {
  sessionId: string;
  revision: number;
  action: { status: 'pending' | 'running' | 'failed' } | null;
  lastCompletedAction: { actionId: string } | null;
}

export interface CodexPanelSessionSpec<TSession extends CodexPanelSession, TReceipt extends { session: TSession }> {
  appName: string;
  create: (name: string) => CodexApp;
  connect: (bridge: CodexApp) => Promise<void>;
  read: (bridge: CodexApp, sessionId: string) => Promise<TSession>;
  notify: (bridge: CodexApp, receipt: TReceipt) => Promise<void>;
  failures: { opening: string; interaction: string };
}

/**
 * Connects a panel app, keeps its session current (tool result, then 2s polling while visible),
 * and runs one Generate at a time with a retryable conversation notification.
 */
export function useCodexPanelSession<TSession extends CodexPanelSession, TReceipt extends { session: TSession }>(spec: CodexPanelSessionSpec<TSession, TReceipt>) {
  const { appName, create, connect, read, notify, failures } = spec;
  const [bridge, setBridge] = useState<CodexApp>();
  const [session, setSession] = useState<TSession>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingNotification, setPendingNotification] = useState<TReceipt>();
  const [newCompletion, setNewCompletion] = useState<NonNullable<TSession['lastCompletedAction']>>();
  const latestSession = useRef<TSession | undefined>(undefined);
  const errorMessage = useCallback((failure: unknown) => failure instanceof Error ? failure.message : failures.interaction, [failures.interaction]);

  const applySession = useCallback((next: TSession) => {
    const previous = latestSession.current;
    if (previous?.sessionId === next.sessionId) {
      if (next.revision < previous.revision) return;
      if (next.lastCompletedAction && next.lastCompletedAction.actionId !== previous.lastCompletedAction?.actionId) {
        setNewCompletion(next.lastCompletedAction as NonNullable<TSession['lastCompletedAction']>);
      }
    } else {
      setNewCompletion(undefined);
    }
    latestSession.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let disposed = false;
    const app = create(appName);
    app.app.ontoolresult = (result) => {
      if (disposed) return;
      if (result.isError) { setError(resultError(result, failures.opening)); return; }
      const next = result.structuredContent?.session as TSession | undefined;
      if (next) applySession(next);
    };
    app.app.onteardown = async () => { disposed = true; setBridge(undefined); return {}; };
    void connect(app).then(() => { if (!disposed) setBridge(app); }).catch((failure) => { if (!disposed) setError(errorMessage(failure)); });
    return () => { disposed = true; void app.app.close(); };
  }, [appName, applySession, connect, create, errorMessage, failures.opening]);

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
      void read(bridge, sessionId)
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
  }, [applySession, bridge, errorMessage, read, sessionId]);

  const run = async (operation: (connected: CodexApp, current: TSession) => Promise<void>) => {
    const current = latestSession.current;
    if (!bridge || !current || busy) return;
    setBusy(true);
    setError(undefined);
    try { await operation(bridge, current); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const generate = (start: (connected: CodexApp, current: TSession) => Promise<TReceipt>) => run(async (connected, current) => {
    if (current.action && current.action.status !== 'failed') return;
    const receipt = await start(connected, current);
    applySession(receipt.session);
    setNewCompletion(undefined);
    await notify(connected, receipt).catch((failure) => {
      setPendingNotification(receipt);
      throw failure;
    });
    setPendingNotification(undefined);
  });

  const retryNotification = () => run(async (connected) => {
    if (!pendingNotification) return;
    await notify(connected, pendingNotification);
    setPendingNotification(undefined);
  });

  return {
    bridge,
    session,
    connected: Boolean(bridge),
    busy,
    error,
    actionActive,
    newCompletion,
    notificationPending: Boolean(pendingNotification),
    applySession,
    run,
    generate,
    retryNotification,
  };
}

function resultError(result: { content: Array<{ type: string; text?: string }>; structuredContent?: Record<string, unknown> }, fallback: string): string {
  const failure = result.structuredContent?.error as { message?: unknown } | undefined;
  if (failure && typeof failure.message === 'string') return failure.message;
  return result.content.find((content) => content.type === 'text')?.text ?? fallback;
}
