import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodexGenerationReviewDisplayMode, GenerationCostEstimate, JsonValue } from '@gorenku/studio-core/client';
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
  const [generateWithoutAsking, setGenerateWithoutAsking] = useState(false);
  const [editedEstimates, setEditedEstimates] = useState<Record<string, GenerationCostEstimate>>({});
  const [refreshingEstimates, setRefreshingEstimates] = useState<string[]>([]);
  const [outdatedEstimates, setOutdatedEstimates] = useState<string[]>([]);
  const estimateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const estimateSequences = useRef(new Map<string, number>());
  const latestReview = useRef<GenerationReview | undefined>(undefined);
  const applyReview = useCallback((next: GenerationReview) => {
    const previous = latestReview.current;
    if (previous?.reviewId === next.reviewId && previous.revision >= next.revision) return;
    latestReview.current = next;
    setReview(next);
    setDrafts(next.drafts);
    setEditedEstimates({});
    estimateTimers.current.forEach((timer) => clearTimeout(timer));
    estimateTimers.current.clear();
    estimateSequences.current.clear();
    setRefreshingEstimates([]);
    setOutdatedEstimates([]);
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
    await sendResponse({
      reviewId: review.reviewId, expectedRevision: review.revision, responseId: crypto.randomUUID(), action, drafts,
      ...(selectedRoute ? { selectedRoute } : {}),
      ...(action === 'submit' && generateWithoutAsking ? { askBeforeGeneratingNextTime: false } : {}),
    });
  };

  const invalidateEstimate = (requestId: string) => {
    const sequence = (estimateSequences.current.get(requestId) ?? 0) + 1;
    estimateSequences.current.set(requestId, sequence);
    clearTimeout(estimateTimers.current.get(requestId));
    estimateTimers.current.delete(requestId);
    setOutdatedEstimates((ids) => [...new Set([...ids, requestId])]);
    setRefreshingEstimates((ids) => ids.filter((id) => id !== requestId));
    return sequence;
  };

  /** Re-estimates edited control values after a short pause; only the latest local edit may update the display. */
  const scheduleEstimate = (requestId: string, values: Record<string, JsonValue>) => {
    const sequence = invalidateEstimate(requestId);
    const current = latestReview.current;
    if (!bridge || !connected || !current) return;
    const isCurrent = () => latestReview.current === current && estimateSequences.current.get(requestId) === sequence;
    setRefreshingEstimates((ids) => [...new Set([...ids, requestId])]);
    estimateTimers.current.set(requestId, setTimeout(() => {
      estimateTimers.current.delete(requestId);
      void bridge.app.callServerTool({ name: 'generation.review.estimate', arguments: { reviewId: current.reviewId, requestId, values } }).then((result) => {
        if (!isCurrent()) return;
        if (result.isError) { setError(resultError(result)); return; }
        const estimate = (result.structuredContent as { estimate?: GenerationCostEstimate } | undefined)?.estimate;
        if (estimate) {
          setEditedEstimates((estimates) => ({ ...estimates, [requestId]: estimate }));
          setOutdatedEstimates((ids) => ids.filter((id) => id !== requestId));
        }
      }).catch((failure) => { if (isCurrent()) setError(errorMessage(failure)); }).finally(() => {
        if (isCurrent()) setRefreshingEstimates((ids) => ids.filter((id) => id !== requestId));
      });
    }, 400));
  };

  useEffect(() => () => {
    estimateTimers.current.forEach((timer) => clearTimeout(timer));
    estimateSequences.current.clear();
  }, []);

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
    generateWithoutAsking, setGenerateWithoutAsking,
    estimateFor: (requestId: string) => editedEstimates[requestId] ?? review?.requests.find((request) => request.requestId === requestId)?.preview.estimate ?? null,
    estimateRefreshing: (requestId: string) => refreshingEstimates.includes(requestId),
    estimateOutdated: (requestId: string) => {
      const request = review?.requests.find((request) => request.requestId === requestId);
      const draft = drafts.find((draft) => draft.requestId === requestId);
      return Boolean(request && draft && request.preview.estimate?.state !== 'hostPlanUsage'
        && (outdatedEstimates.includes(requestId) || draft.prompt !== request.preview.prompt));
    },
    editPrompt: (requestId: string, prompt: string) => {
      invalidateEstimate(requestId);
      editDraft(requestId, { prompt });
    },
    editValue: (requestId: string, key: string, value: JsonValue | undefined) => {
      const draft = drafts.find((draft) => draft.requestId === requestId);
      if (!draft) return;
      const values = { ...draft.values };
      if (value === undefined) delete values[key];
      else values[key] = value;
      editDraft(requestId, { values });
      scheduleEstimate(requestId, values);
    },
  };
}

function resultError(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.find((content) => content.type === 'text')?.text ?? 'The review action failed.';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The review interaction failed.';
}
