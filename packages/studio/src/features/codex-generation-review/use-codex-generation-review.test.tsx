// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationReview, GenerationReviewReceipt, GenerationReviewResponse } from '@gorenku/studio-codex/client';
import { useCodexGenerationReview } from './use-codex-generation-review';

const integration = vi.hoisted(() => ({
  bridge: { app: {
    ontoolresult: undefined as ((result: { isError?: boolean; content: Array<{ type: string; text?: string }>; structuredContent?: { review: GenerationReview } }) => void) | undefined,
    onteardown: undefined as (() => Promise<object>) | undefined,
    callServerTool: vi.fn(), readServerResource: vi.fn(), close: vi.fn(),
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
  });
  integration.bridge.app.callServerTool.mockImplementation(async ({ arguments: response }: { arguments: GenerationReviewResponse }) => {
    const action: GenerationReviewReceipt = { reviewId: response.reviewId, responseId: response.responseId, revision: 2, action: response.action };
    return { content: [], structuredContent: { action, review: { ...reviewFixture(), revision: 2, phase: 'submitted', drafts: response.drafts } } };
  });
});

afterEach(cleanup);

function reviewFixture(): GenerationReview {
  return {
    reviewId: 'review', revision: 1, phase: 'ready', diagnostics: [],
    requests: [{
      requestId: 'request', requestSha256: 'a'.repeat(64),
      preview: { kind: 'mediaGenerationPreview', provider: 'fal-ai', model: 'image-model', mediaKind: 'image', prompt: 'Café', editable: true, references: [], configuration: {}, diagnostics: [] },
      routes: [{ provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'image-model', label: 'Image model', mediaKind: 'image' }],
      controls: { groups: [] },
    }],
    drafts: [{ requestId: 'request', prompt: 'Café', values: {} }],
  };
}

describe('generation review conversation handoff', () => {
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
