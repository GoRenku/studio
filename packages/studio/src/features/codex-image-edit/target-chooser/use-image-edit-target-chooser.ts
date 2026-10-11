import { useEffect, useState } from 'react';
import type { ImageEditTargetChoice, ImageEditTargetChooser } from '@gorenku/studio-codex/image-edit';
import type { CodexApp } from '@/services/codex-app';
import {
  connectImageEditTargetChooserApp,
  createImageEditTargetChooserApp,
  notifyImageEditTargetChoice,
  respondToImageEditTargetChooser,
} from '@/services/codex-image-edit';

/** Receives the chooser from the opening tool result, records one answer and posts it to the conversation. */
export function useImageEditTargetChooser(appName: string, subjectFor: (chooser: ImageEditTargetChooser) => string | null) {
  const [bridge, setBridge] = useState<CodexApp>();
  const [chooser, setChooser] = useState<ImageEditTargetChooser>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notificationPending, setNotificationPending] = useState(false);

  useEffect(() => {
    let disposed = false;
    const app = createImageEditTargetChooserApp(appName);
    app.app.ontoolresult = (result) => {
      if (disposed) return;
      const next = result.structuredContent?.chooser as ImageEditTargetChooser | undefined;
      if (result.isError || !next) {
        const failure = result.structuredContent?.error as { message?: unknown } | undefined;
        setError(typeof failure?.message === 'string' ? failure.message : 'The image chooser could not be opened.');
        return;
      }
      setChooser(next);
    };
    app.app.onteardown = async () => { disposed = true; setBridge(undefined); return {}; };
    void connectImageEditTargetChooserApp(app).then(() => { if (!disposed) setBridge(app); }).catch((failure) => { if (!disposed) setError(errorMessage(failure)); });
    return () => { disposed = true; void app.app.close(); };
  }, [appName]);

  const notify = async (connected: CodexApp, answered: ImageEditTargetChooser) => {
    try {
      await notifyImageEditTargetChoice(connected, answered, subjectFor(answered));
      setNotificationPending(false);
    } catch (failure) {
      setNotificationPending(true);
      throw failure;
    }
  };

  const run = async (operation: (connected: CodexApp, current: ImageEditTargetChooser) => Promise<void>) => {
    if (!bridge || !chooser || busy) return;
    setBusy(true);
    setError(undefined);
    try { await operation(bridge, chooser); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const respond = (choice: ImageEditTargetChoice) => run(async (connected, current) => {
    if (current.choice) return;
    const answered = await respondToImageEditTargetChooser(connected, { chooserId: current.chooserId, choice });
    setChooser(answered);
    await notify(connected, answered);
  });

  const retryNotification = () => run((connected, current) => notify(connected, current));

  return { bridge, chooser, connected: Boolean(bridge), busy, error, notificationPending, respond, retryNotification };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The image chooser interaction failed.';
}
