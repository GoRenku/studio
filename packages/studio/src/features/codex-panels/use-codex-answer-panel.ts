import { useEffect, useRef, useState } from 'react';
import type { CodexApp } from '@/services/codex-app';

export interface CodexAnswerPanelSpec {
  appName: string;
  /** The opening tool result's structured content key that holds the panel. */
  resultKey: string;
  create: (name: string) => CodexApp;
  connect: (bridge: CodexApp) => Promise<void>;
  failures: { opening: string; interaction: string };
}

/**
 * Receives a one-answer panel from its opening tool result, records the user's answer once
 * and posts a retryable conversation notification.
 */
export function useCodexAnswerPanel<TPanel extends { answer: unknown }>(spec: CodexAnswerPanelSpec) {
  const { appName, resultKey, create, connect, failures } = spec;
  const [bridge, setBridge] = useState<CodexApp>();
  const [panel, setPanel] = useState<TPanel>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pendingNotification = useRef<((connected: CodexApp) => Promise<void>) | undefined>(undefined);
  const [notificationPending, setNotificationPending] = useState(false);
  const errorMessage = (failure: unknown) => failure instanceof Error ? failure.message : failures.interaction;

  useEffect(() => {
    let disposed = false;
    const app = create(appName);
    app.app.ontoolresult = (result) => {
      if (disposed) return;
      const next = result.structuredContent?.[resultKey] as TPanel | undefined;
      if (result.isError || !next) {
        const failure = result.structuredContent?.error as { message?: unknown } | undefined;
        setError(typeof failure?.message === 'string' ? failure.message : failures.opening);
        return;
      }
      setPanel(next);
    };
    app.app.onteardown = async () => { disposed = true; setBridge(undefined); return {}; };
    void connect(app).then(() => { if (!disposed) setBridge(app); }).catch((failure) => { if (!disposed) setError(failure instanceof Error ? failure.message : failures.interaction); });
    return () => { disposed = true; void app.app.close(); };
  }, [appName, connect, create, failures.interaction, failures.opening, resultKey]);

  const run = async (operation: (connected: CodexApp, current: TPanel) => Promise<void>) => {
    if (!bridge || !panel || busy) return;
    setBusy(true);
    setError(undefined);
    try { await operation(bridge, panel); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const notifyOnce = async (connected: CodexApp, notify: (connected: CodexApp) => Promise<void>) => {
    try {
      await notify(connected);
      pendingNotification.current = undefined;
      setNotificationPending(false);
    } catch (failure) {
      pendingNotification.current = notify;
      setNotificationPending(true);
      throw failure;
    }
  };

  /** Records the answer once, then posts the notice built from the answered panel. */
  const answer = (
    respond: (connected: CodexApp, current: TPanel) => Promise<TPanel>,
    notify: (connected: CodexApp, answered: TPanel) => Promise<void>,
  ) => run(async (connected, current) => {
    if (current.answer) return;
    const answered = await respond(connected, current);
    setPanel(answered);
    await notifyOnce(connected, (target) => notify(target, answered));
  });

  const retryNotification = () => run(async (connected) => {
    const notify = pendingNotification.current;
    if (notify) await notifyOnce(connected, notify);
  });

  return { bridge, panel, connected: Boolean(bridge), busy, error, notificationPending, answer, retryNotification };
}
