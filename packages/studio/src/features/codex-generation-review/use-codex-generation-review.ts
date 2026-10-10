import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodexGenerationReviewDisplayMode, JsonValue } from '@gorenku/studio-core/client';
import type { GenerationReview, GenerationReviewReceipt, GenerationReviewDraft, GenerationReviewResponse } from '@gorenku/studio-codex/client';
import { connectCodexApp, createCodexApp, notifyGenerationReviewAction, type CodexApp } from '@/services/codex-app';

export function useCodexGenerationReview() {
  const [bridge, setBridge] = useState<CodexApp>();
  const [review, setReview] = useState<GenerationReview>();
  const [drafts, setDrafts] = useState<GenerationReviewDraft[]>([]);
  const [connected, setConnected] = useState(false);
  const [displayMode, setDisplayMode] = useState<CodexGenerationReviewDisplayMode>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notification, setNotification] = useState<GenerationReviewReceipt>();
  const [pendingResponse, setPendingResponse] = useState<GenerationReviewResponse>();
  const latestReview = useRef<GenerationReview | undefined>(undefined);
  const applyReview = useCallback((next: GenerationReview) => {
    const previous = latestReview.current;
    if (previous?.reviewId === next.reviewId && previous.revision >= next.revision) return;
    latestReview.current = next;
    setReview(next);
    setDrafts(next.drafts);
  }, []);

  useEffect(() => {
    let disposed = false;
    const app = createCodexApp('Renku generation review', ['inline', 'fullscreen']);
    app.app.addEventListener('hostcontextchanged', (context) => {
      if (!disposed && (context.displayMode === 'inline' || context.displayMode === 'fullscreen')) setDisplayMode(context.displayMode);
    });
    app.app.ontoolresult = (result) => {
      if (disposed) return;
      if (result.isError) { setError(resultError(result)); return; }
      const next = result.structuredContent?.review as GenerationReview | undefined;
      if (next) applyReview(next);
    };
    app.app.onteardown = async () => { disposed = true; setConnected(false); return {}; };
    void connectCodexApp(app, true).then((mode) => { if (!disposed) { setDisplayMode(mode); setBridge(app); setConnected(true); } }).catch((failure) => { if (!disposed) setError(errorMessage(failure)); });
    return () => { disposed = true; void app.app.close(); };
  }, [applyReview]);

  useEffect(() => {
    if (!bridge || !connected || review?.phase !== 'preparing') return;
    let disposed = false;
    let reading = false;
    const interval = setInterval(() => {
      if (disposed || reading || document.visibilityState === 'hidden') return;
      reading = true;
      void bridge.app.readServerResource({ uri: `renku-review://${review.reviewId}` }).then((result) => {
        const content = result.contents[0];
        if (disposed || !content || !('text' in content)) return;
        const next = JSON.parse(content.text) as GenerationReview;
        if (next.reviewId === review.reviewId) applyReview(next);
      }).catch((failure) => { if (!disposed) setError(errorMessage(failure)); }).finally(() => { reading = false; });
    }, 2000);
    return () => { disposed = true; clearInterval(interval); };
  }, [applyReview, bridge, connected, review]);

  const editDraft = (requestId: string, change: Partial<GenerationReviewDraft>) => {
    setDrafts((current) => current.map((draft) => draft.requestId === requestId ? { ...draft, ...change } : draft));
  };

  const sendResponse = async (response: GenerationReviewResponse) => {
    if (!bridge || !connected || busy) return;
    setBusy(true);
    setError(undefined);
    setPendingResponse(response);
    try {
      const result = await bridge.app.callServerTool({ name: 'generation.review.respond', arguments: { ...response } });
      if (result.isError) { setPendingResponse(undefined); setError(resultError(result)); return; }
      const accepted = result.structuredContent as unknown as { action: GenerationReviewReceipt; review: GenerationReview };
      applyReview(accepted.review);
      setPendingResponse(undefined);
      setNotification(accepted.action);
      await notifyGenerationReviewAction(bridge, accepted.action);
      setNotification(undefined);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  const respond = async (action: GenerationReviewResponse['action'], selectedRoute?: GenerationReviewResponse['selectedRoute']) => {
    if (!review || pendingResponse) return;
    await sendResponse({ reviewId: review.reviewId, expectedRevision: review.revision, responseId: crypto.randomUUID(), action, drafts, ...(selectedRoute ? { selectedRoute } : {}) });
  };

  const retryResponse = async () => {
    if (pendingResponse) await sendResponse(pendingResponse);
  };

  const retryNotification = async () => {
    if (!bridge || !notification || busy) return;
    setBusy(true);
    try { await notifyGenerationReviewAction(bridge, notification); setNotification(undefined); setError(undefined); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };

  return {
    bridge, review, drafts, connected, displayMode, busy, error, notification, pendingResponse, respond, retryResponse, retryNotification,
    editPrompt: (requestId: string, prompt: string) => editDraft(requestId, { prompt }),
    editValue: (requestId: string, key: string, value: JsonValue | undefined) => {
      const draft = drafts.find((draft) => draft.requestId === requestId);
      if (!draft) return;
      const values = { ...draft.values };
      if (value === undefined) delete values[key];
      else values[key] = value;
      editDraft(requestId, { values });
    },
  };
}

function resultError(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.find((content) => content.type === 'text')?.text ?? 'The review action failed.';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The review interaction failed.';
}
