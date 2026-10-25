// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationReview, GenerationReviewReceipt, GenerationReviewResponse } from '@gorenku/studio-codex/client';
import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import { useCodexGenerationReview } from './use-codex-generation-review';

const integration = vi.hoisted(() => ({
  bridge: { app: {
    ontoolresult: undefined as ((result: { isError?: boolean; content: Array<{ type: string; text?: string }>; structuredContent?: { review: GenerationReview } }) => void) | undefined,
    onteardown: undefined as (() => Promise<object>) | undefined,
    callServerTool: vi.fn(), readServerResource: vi.fn(), close: vi.fn(), addEventListener: vi.fn(),
  } },
  connect: vi.fn(), notify: vi.fn(),
}));

vi.mock('@/services/codex-app', () => ({
  createCodexApp: () => integration.bridge,
  connectCodexApp: integration.connect,
  notifyGenerationReviewAction: integration.notify,
}));

beforeEach(() => {
  vi.clearAllMocks();
  integration.notify.mockResolvedValue(undefined);
  integration.connect.mockImplementation(async () => {
    expect(integration.bridge.app.ontoolresult).toBeTypeOf('function');
    expect(integration.bridge.app.onteardown).toBeTypeOf('function');
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { review: reviewFixture() } });
    return 'inline';
  });
  integration.bridge.app.callServerTool.mockImplementation(async ({ arguments: response }: { arguments: GenerationReviewResponse }) => {
    const action: GenerationReviewReceipt = { reviewId: response.reviewId, responseId: response.responseId, revision: 2, action: response.action };
    return { content: [], structuredContent: { action, review: { ...reviewFixture(), revision: 2, phase: 'submitted', drafts: response.drafts } } };
  });
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

function estimateResult(amountUsd: number) {
  const estimate: GenerationCostEstimate = { state: 'computed', amountUsd, basis: 'Fixture price', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'a'.repeat(64) };
  return { content: [], structuredContent: { estimate } };
}

function reviewFixture(): GenerationReview {
  return {
    reviewId: 'review', revision: 1, lane: 'image', phase: 'ready', diagnostics: [],
    requests: [{
      requestId: 'request', requestSha256: 'a'.repeat(64),
      preview: { kind: 'mediaGenerationPreview', provider: 'fal-ai', model: 'image-model', mediaKind: 'image', prompt: 'Café', editable: true, references: [], configuration: {}, diagnostics: [], requestSha256: 'a'.repeat(64), estimate: null },
      routes: [{ provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'image-model', label: 'Image model', mediaKind: 'image' }],
      controls: { groups: [] },
    }],
    drafts: [{ requestId: 'request', prompt: 'Café', values: {} }],
  };
}

describe('generation review estimates and settings', () => {
  it('re-estimates edited values through the app-only tool', async () => {
    const estimate = { state: 'computed', amountUsd: 0.08, basis: '2 images × $0.04', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'a'.repeat(64) };
    integration.bridge.app.callServerTool.mockResolvedValue({ content: [], structuredContent: { estimate } });
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.estimateFor('request')).toBeNull();
    act(() => result.current.editValue('request', '/num_images', 2));
    await waitFor(() => expect(result.current.estimateFor('request')).toEqual(estimate));
    expect(integration.bridge.app.callServerTool).toHaveBeenCalledWith({ name: 'generation.review.estimate', arguments: { reviewId: 'review', requestId: 'request', values: { '/num_images': 2 } } });
  });

  it('sends Generate without asking next time only with Submit', async () => {
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => result.current.setGenerateWithoutAsking(true));
    await act(async () => { await result.current.respond('submit'); });
    expect(integration.bridge.app.callServerTool.mock.calls[0]![0].arguments).toMatchObject({ action: 'submit', askBeforeGeneratingNextTime: false });
  });

  it('never sends the toggle with Cancel', async () => {
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => result.current.setGenerateWithoutAsking(true));
    await act(async () => { await result.current.respond('cancel'); });
    expect(integration.bridge.app.callServerTool.mock.calls[0]![0].arguments).not.toHaveProperty('askBeforeGeneratingNextTime');
  });

  it('keeps the latest estimate when an older request finishes afterward', async () => {
    const pending: Array<(result: ReturnType<typeof estimateResult>) => void> = [];
    integration.bridge.app.callServerTool.mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    vi.useFakeTimers();
    act(() => result.current.editValue('request', '/duration', 5));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => result.current.editValue('request', '/duration', 10));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await act(async () => { pending[1]!(estimateResult(1)); });
    expect(result.current.estimateFor('request')?.amountUsd).toBe(1);
    expect(result.current.estimateOutdated('request')).toBe(false);
    await act(async () => { pending[0]!(estimateResult(0.5)); });
    expect(result.current.estimateFor('request')?.amountUsd).toBe(1);
  });

  it('invalidates a running estimate as soon as another edit starts its debounce', async () => {
    const pending: Array<(result: ReturnType<typeof estimateResult>) => void> = [];
    integration.bridge.app.callServerTool.mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    vi.useFakeTimers();
    act(() => result.current.editValue('request', '/duration', 5));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => result.current.editValue('request', '/duration', 10));
    expect(result.current.estimateOutdated('request')).toBe(true);
    await act(async () => { pending[0]!(estimateResult(0.5)); });
    expect(result.current.estimateFor('request')).toBeNull();
    expect(result.current.estimateRefreshing('request')).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await act(async () => { pending[1]!(estimateResult(1)); });
    expect(result.current.estimateOutdated('request')).toBe(false);
    expect(result.current.estimateRefreshing('request')).toBe(false);
  });

  it('keeps a failed refresh outdated and ignores errors from superseded requests', async () => {
    let rejectPrevious!: (failure: Error) => void;
    integration.bridge.app.callServerTool
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPrevious = reject; }))
      .mockResolvedValueOnce({ isError: true, content: [{ type: 'text', text: 'Current estimate unavailable.' }] });
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    vi.useFakeTimers();
    act(() => result.current.editValue('request', '/duration', 5));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => result.current.editValue('request', '/duration', 10));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(result.current.estimateOutdated('request')).toBe(true);
    expect(result.current.estimateRefreshing('request')).toBe(false);
    await act(async () => { rejectPrevious(new Error('Obsolete estimate failure.')); });
    expect(result.current.error).toBe('Current estimate unavailable.');
  });

  it('marks prompt edits outdated through both running and subsequent settings estimates', async () => {
    const initial = reviewFixture();
    initial.requests[0]!.preview.estimate = estimateResult(0.04).structuredContent.estimate;
    integration.connect.mockImplementation(async () => {
      integration.bridge.app.ontoolresult!({ content: [], structuredContent: { review: initial } });
      return 'inline';
    });
    let finishPrevious!: (result: ReturnType<typeof estimateResult>) => void;
    integration.bridge.app.callServerTool
      .mockImplementationOnce(() => new Promise((resolve) => { finishPrevious = resolve; }))
      .mockResolvedValueOnce(estimateResult(0.08));
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    vi.useFakeTimers();
    act(() => result.current.editValue('request', '/duration', 5));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => result.current.editPrompt('request', 'A much longer narration.'));
    expect(result.current.estimateOutdated('request')).toBe(true);
    expect(result.current.estimateRefreshing('request')).toBe(false);
    await act(async () => { finishPrevious(estimateResult(0.06)); });
    expect(result.current.estimateFor('request')?.amountUsd).toBe(0.04);
    act(() => result.current.editValue('request', '/duration', 10));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(result.current.estimateFor('request')?.amountUsd).toBe(0.08);
    expect(result.current.estimateOutdated('request')).toBe(true);
  });

  it('discards a late estimate when a different review has the same revision', async () => {
    let finishPrevious!: (result: ReturnType<typeof estimateResult>) => void;
    integration.bridge.app.callServerTool.mockImplementation(() => new Promise((resolve) => { finishPrevious = resolve; }));
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    vi.useFakeTimers();
    act(() => result.current.editValue('request', '/duration', 5));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    act(() => integration.bridge.app.ontoolresult!({ content: [], structuredContent: { review: { ...reviewFixture(), reviewId: 'another-review' } } }));
    await act(async () => { finishPrevious(estimateResult(0.5)); });
    expect(result.current.estimateFor('request')).toBeNull();
    expect(result.current.estimateOutdated('request')).toBe(false);
    expect(result.current.estimateRefreshing('request')).toBe(false);
  });
});

describe('generation review conversation handoff', () => {
  it('projects the initial host mode and subsequent host switches without replacing edited drafts', async () => {
    const { result, unmount } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.displayMode).toBe('inline');
    act(() => result.current.editPrompt('request', 'Exact edited prompt'));
    const onContextChanged = integration.bridge.app.addEventListener.mock.calls[0]![1];
    act(() => onContextChanged({ displayMode: 'fullscreen' }));
    expect(result.current.displayMode).toBe('fullscreen');
    act(() => onContextChanged({ theme: 'dark' }));
    expect(result.current.displayMode).toBe('fullscreen');
    act(() => onContextChanged({ displayMode: 'inline' }));
    expect(result.current.displayMode).toBe('inline');
    expect(result.current.drafts[0]?.prompt).toBe('Exact edited prompt');
    expect(integration.bridge.app.callServerTool).not.toHaveBeenCalled();
    unmount();
    act(() => onContextChanged({ displayMode: 'fullscreen' }));
    expect(result.current.displayMode).toBe('inline');
  });

  it('registers handlers before connection and stores exact edited values before notification', async () => {
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => { result.current.editPrompt('request', 'Étude\nα and @Image1'); result.current.editValue('request', '/resolution', '4K'); });
    await act(async () => { await result.current.respond('submit'); });
    const response = integration.bridge.app.callServerTool.mock.calls[0]![0].arguments as GenerationReviewResponse;
    expect(response.drafts).toEqual([{ requestId: 'request', prompt: 'Étude\nα and @Image1', values: { '/resolution': '4K' } }]);
    expect(integration.notify).toHaveBeenCalledWith(integration.bridge, { reviewId: 'review', responseId: response.responseId, revision: 2, action: 'submit' });
    expect(integration.bridge.app.callServerTool.mock.invocationCallOrder[0]).toBeLessThan(integration.notify.mock.invocationCallOrder[0]!);
    expect(result.current.review?.phase).toBe('submitted');
    expect(result.current.notification).toBeUndefined();
  });

  it('retries only notification after send failure and ignores late tool results', async () => {
    integration.notify.mockRejectedValueOnce(new Error('Conversation delivery failed.'));
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    await act(async () => { await result.current.respond('submit'); });
    const accepted = result.current.notification;
    expect(result.current.review?.phase).toBe('submitted');
    expect(result.current.error).toBe('Conversation delivery failed.');
    act(() => integration.bridge.app.ontoolresult!({ content: [], structuredContent: { review: reviewFixture() } }));
    expect(result.current.review?.phase).toBe('submitted');
    await act(async () => { await result.current.retryNotification(); });
    expect(integration.notify).toHaveBeenLastCalledWith(integration.bridge, accepted);
    expect(integration.bridge.app.callServerTool).toHaveBeenCalledTimes(1);
    expect(result.current.notification).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('retries an ambiguous storage failure with the same response identity and exact draft', async () => {
    integration.bridge.app.callServerTool.mockRejectedValueOnce(new Error('Connection lost after storage.'));
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => result.current.editPrompt('request', 'Étude\nα'));
    await act(async () => { await result.current.respond('submit'); });
    const response = integration.bridge.app.callServerTool.mock.calls[0]![0].arguments;
    expect(result.current.pendingResponse).toEqual(response);
    expect(integration.notify).not.toHaveBeenCalled();
    await act(async () => { await result.current.respond('cancel'); });
    expect(integration.bridge.app.callServerTool).toHaveBeenCalledOnce();
    await act(async () => { await result.current.retryResponse(); });
    expect(integration.bridge.app.callServerTool.mock.calls[1]![0].arguments).toEqual(response);
    expect(result.current.pendingResponse).toBeUndefined();
    expect(result.current.review?.phase).toBe('submitted');
    expect(integration.notify).toHaveBeenCalledOnce();
  });

  it('keeps the review editable after a definite validation rejection', async () => {
    integration.bridge.app.callServerTool.mockResolvedValueOnce({ isError: true, content: [{ type: 'text', text: 'Invalid resolution.' }] });
    const { result } = renderHook(() => useCodexGenerationReview());
    await waitFor(() => expect(result.current.connected).toBe(true));
    await act(async () => { await result.current.respond('submit'); });
    expect(result.current.pendingResponse).toBeUndefined();
    expect(result.current.review?.phase).toBe('ready');
    expect(result.current.error).toBe('Invalid resolution.');
    expect(integration.notify).not.toHaveBeenCalled();
  });
});
