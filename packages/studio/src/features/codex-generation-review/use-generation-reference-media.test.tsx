// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationReviewReference } from '@gorenku/studio-codex/client';
import type { CodexApp } from '@/services/codex-app';
import { useGenerationReferenceMedia } from './use-generation-reference-media';

const observers: Array<IntersectionObserverCallback> = [];
const readServerResource = vi.fn();
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
const bridge = { app: { readServerResource } } as unknown as CodexApp;

beforeEach(() => {
  observers.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { observers.push(callback); }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  createObjectURL.mockImplementation(() => `blob:reference-${createObjectURL.mock.calls.length}`);
  readServerResource.mockImplementation(async ({ uri }: { uri: string }) => resource(uri));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function reference(index = 0): GenerationReviewReference {
  const resourceUri = `renku-reference://review/reference-${index}`;
  return { requestPointer: `/images/${index}`, kind: 'image', reviewLabel: 'Opening frame', available: true, referenceId: `reference-${index}`, resourceUri, thumbnailUri: `${resourceUri}/thumbnail` };
}

function resource(uri: string) {
  return { contents: [{ uri, mimeType: 'image/webp', blob: 'AQID' }] };
}

function reveal(index = 0) {
  observers[index]!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
}

describe('scoped generation reference media', () => {
  it('loads only a visible thumbnail, reads the full reference on demand and releases object URLs', async () => {
    const declared = reference();
    const container = { current: document.createElement('div') };
    const { result, unmount } = renderHook(() => useGenerationReferenceMedia(bridge, declared, container));
    expect(readServerResource).not.toHaveBeenCalled();
    act(() => reveal());
    await waitFor(() => expect(result.current.source.browserUrl).toBe('blob:reference-1'));
    expect(readServerResource).toHaveBeenCalledExactlyOnceWith({ uri: declared.thumbnailUri });
    let full: string | undefined;
    await act(async () => { full = await result.current.source.loadPreview(); });
    expect(readServerResource).toHaveBeenLastCalledWith({ uri: declared.resourceUri });
    await act(async () => { await expect(result.current.source.loadPreview()).resolves.toBe(full); });
    expect(readServerResource).toHaveBeenCalledTimes(2);
    unmount();
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(['blob:reference-1', 'blob:reference-2']);
  });

  it('loads a visible audio reference automatically, caches its playback URL and releases it on unmount', async () => {
    const declared: GenerationReviewReference = { ...reference(), kind: 'audio', thumbnailUri: undefined };
    let complete!: () => void;
    readServerResource.mockImplementation(({ uri }: { uri: string }) => new Promise((resolve) => {
      complete = () => resolve({ contents: [{ uri, mimeType: 'audio/mpeg', blob: 'AQID' }] });
    }));
    const container = { current: document.createElement('div') };
    const { result, unmount } = renderHook(() => useGenerationReferenceMedia(bridge, declared, container));
    expect(readServerResource).not.toHaveBeenCalled();
    act(() => reveal());
    expect(result.current.loading).toBe(true);
    expect(readServerResource).toHaveBeenCalledExactlyOnceWith({ uri: declared.resourceUri });
    await act(async () => complete());
    await waitFor(() => expect(result.current.source.browserUrl).toBe('blob:reference-1'));
    expect(result.current.loading).toBe(false);
    expect((createObjectURL.mock.calls[0]![0] as Blob).type).toBe('audio/mpeg');
    await act(async () => { await expect(result.current.source.loadPreview()).resolves.toBe('blob:reference-1'); });
    expect(readServerResource).toHaveBeenCalledTimes(1);
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:reference-1');
  });

  it('keeps video and unavailable audio lazy instead of reading their full files on visibility', async () => {
    const declared = [
      { ...reference(), kind: 'video', thumbnailUri: undefined },
      { ...reference(1), kind: 'audio', thumbnailUri: undefined, available: false },
    ] as const;
    const containers = declared.map(() => ({ current: document.createElement('div') }));
    renderHook(() => [
      useGenerationReferenceMedia(bridge, declared[0], containers[0]!),
      useGenerationReferenceMedia(bridge, declared[1], containers[1]!),
    ]);
    act(() => { reveal(); reveal(1); });
    expect(readServerResource).not.toHaveBeenCalled();
  });

  it('allows an audio read failure to be retried without retaining the error', async () => {
    readServerResource.mockRejectedValueOnce({ code: -32603 });
    const declared: GenerationReviewReference = { ...reference(), kind: 'audio', thumbnailUri: undefined };
    const container = { current: document.createElement('div') };
    const { result, unmount } = renderHook(() => useGenerationReferenceMedia(bridge, declared, container));
    act(() => reveal());
    await waitFor(() => expect(result.current.error).toBe('The host could not read this reference (MCP -32603).'));
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.source.loadPreview(); });
    expect(result.current.error).toBeUndefined();
    expect(readServerResource).toHaveBeenCalledTimes(2);
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:reference-1');
  });

  it('discards audio bytes returned after the reference is unmounted', async () => {
    const declared: GenerationReviewReference = { ...reference(), kind: 'audio', thumbnailUri: undefined };
    let complete!: () => void;
    readServerResource.mockImplementation(({ uri }: { uri: string }) => new Promise((resolve) => { complete = () => resolve(resource(uri)); }));
    const container = { current: document.createElement('div') };
    const { unmount } = renderHook(() => useGenerationReferenceMedia(bridge, declared, container));
    act(() => reveal());
    unmount();
    await act(async () => complete());
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('clears loading when the reference becomes unavailable and ignores its late response', async () => {
    const declared: GenerationReviewReference = { ...reference(), kind: 'audio', thumbnailUri: undefined };
    let complete!: () => void;
    readServerResource.mockImplementation(({ uri }: { uri: string }) => new Promise((resolve) => { complete = () => resolve(resource(uri)); }));
    const container = { current: document.createElement('div') };
    const { result, rerender } = renderHook(({ available }) => useGenerationReferenceMedia(bridge, { ...declared, available }, container), { initialProps: { available: true } });
    act(() => reveal());
    expect(result.current.loading).toBe(true);
    rerender({ available: false });
    expect(result.current.loading).toBe(false);
    await act(async () => complete());
    expect(result.current.source.browserUrl).toBeUndefined();
    act(() => reveal(1));
    expect(readServerResource).toHaveBeenCalledTimes(1);
  });

  it('shows the transport failure category without exposing the server error contents', async () => {
    readServerResource.mockRejectedValue({ code: -32000, message: 'private path /Users/example/secret.png' });
    const declared = reference();
    const container = { current: document.createElement('div') };
    const { result } = renderHook(() => useGenerationReferenceMedia(bridge, declared, container));
    act(() => reveal());
    await waitFor(() => expect(result.current.error).toBe('The host could not read this reference (MCP -32000).'));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects resource responses that do not contain the declared media bytes', async () => {
    readServerResource.mockResolvedValue({ contents: [{ uri: 'renku-reference://other/reference', text: 'unrelated', mimeType: 'text/plain' }] });
    const declared = reference();
    const container = { current: document.createElement('div') };
    const { result } = renderHook(() => useGenerationReferenceMedia(bridge, declared, container));
    act(() => reveal());
    await waitFor(() => expect(result.current.error).toBe('The host returned a reference without its media bytes.'));
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('bounds concurrent visible thumbnail reads to three without fetching full images', async () => {
    const complete: Array<() => void> = [];
    readServerResource.mockImplementation(({ uri }: { uri: string }) => new Promise((resolve) => { complete.push(() => resolve(resource(uri))); }));
    const declared = Array.from({ length: 4 }, (_, index) => reference(index));
    const containers = declared.map(() => ({ current: document.createElement('div') }));
    const { result } = renderHook(() => [
      useGenerationReferenceMedia(bridge, declared[0]!, containers[0]!),
      useGenerationReferenceMedia(bridge, declared[1]!, containers[1]!),
      useGenerationReferenceMedia(bridge, declared[2]!, containers[2]!),
      useGenerationReferenceMedia(bridge, declared[3]!, containers[3]!),
    ]);
    act(() => { for (let index = 0; index < 4; index += 1) reveal(index); });
    expect(readServerResource).toHaveBeenCalledTimes(3);
    await act(async () => { complete[0]!(); });
    await waitFor(() => expect(readServerResource).toHaveBeenCalledTimes(4));
    await act(async () => { complete.slice(1).forEach((resolve) => resolve()); });
    await waitFor(() => expect(result.current.every((entry) => entry.source.browserUrl)).toBe(true));
    expect(readServerResource.mock.calls.every(([input]) => input.uri.endsWith('/thumbnail'))).toBe(true);
  });
});
