import { useEffect, useState } from 'react';
import type { RouteChooser, RouteRespondInput } from '@gorenku/studio-codex/route-choice';
import type { CodexApp } from '@/services/codex-app';
import {
  connectRouteChooserApp,
  createRouteChooserApp,
  notifyRouteChoice,
  respondToRouteChooser,
} from '@/services/codex-route-choice';

/** Receives the chooser from the opening tool result, records one answer and posts it to the conversation. */
export function useRouteChooser(appName: string, subjectFor: (chooser: RouteChooser) => string | null) {
  const [bridge, setBridge] = useState<CodexApp>();
  const [chooser, setChooser] = useState<RouteChooser>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notificationPending, setNotificationPending] = useState(false);

  useEffect(() => {
    let disposed = false;
    const app = createRouteChooserApp(appName);
    app.app.ontoolresult = (result) => {
      if (disposed) return;
      const next = result.structuredContent?.chooser as RouteChooser | undefined;
      if (result.isError || !next) {
        const failure = result.structuredContent?.error as { message?: unknown } | undefined;
        setError(typeof failure?.message === 'string' ? failure.message : 'The provider and model chooser could not be opened.');
        return;
      }
      setChooser(next);
    };
    app.app.onteardown = async () => { disposed = true; setBridge(undefined); return {}; };
    void connectRouteChooserApp(app).then(() => { if (!disposed) setBridge(app); }).catch((failure) => { if (!disposed) setError(errorMessage(failure)); });
    return () => { disposed = true; void app.app.close(); };
  }, [appName]);

  const notify = async (connected: CodexApp, answered: RouteChooser) => {
    try {
      await notifyRouteChoice(connected, answered, subjectFor(answered));
      setNotificationPending(false);
    } catch (failure) {
      setNotificationPending(true);
      throw failure;
    }
  };

  const run = async (operation: (connected: CodexApp, current: RouteChooser) => Promise<void>) => {
    if (!bridge || !chooser || busy) return;
    setBusy(true);
    setError(undefined);
    try { await operation(bridge, chooser); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const respond = (input: Omit<RouteRespondInput, 'choiceId'>) => run(async (connected, current) => {
    if (current.answer) return;
    const answered = await respondToRouteChooser(connected, { ...input, choiceId: current.choiceId });
    setChooser(answered);
    await notify(connected, answered);
  });

  const retryNotification = () => run((connected, current) => notify(connected, current));

  return { chooser, connected: Boolean(bridge), busy, error, notificationPending, respond, retryNotification };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The provider and model chooser interaction failed.';
}
