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
    await waitFor(() => expect(result.current.source.thumbnailUrl).toBe('blob:reference-1'));
    expect(readServerResource).toHaveBeenCalledExactlyOnceWith({ uri: declared.thumbnailUri });
    let full: string | undefined;
    await act(async () => { full = await result.current.source.loadPreview(); });
    expect(readServerResource).toHaveBeenLastCalledWith({ uri: declared.resourceUri });
    await expect(result.current.source.loadPreview()).resolves.toBe(full);
    expect(readServerResource).toHaveBeenCalledTimes(2);
    unmount();
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(['blob:reference-1', 'blob:reference-2']);
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
    await waitFor(() => expect(result.current.every((entry) => entry.source.thumbnailUrl)).toBe(true));
    expect(readServerResource.mock.calls.every(([input]) => input.uri.endsWith('/thumbnail'))).toBe(true);
  });
});
