// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FdxUpdateReview } from '@gorenku/studio-core/client';
import { StudioApiError } from '@/services/studio-api-errors';
import { readFdxUpdateStatus, reviewFdxUpdate, applyFdxUpdate } from '@/services/screenplay/fdx-updates';
import { useFdxUpdate } from './use-fdx-update';

vi.mock('@/services/screenplay/fdx-updates', () => ({
  readFdxUpdateStatus: vi.fn(), reviewFdxUpdate: vi.fn(), applyFdxUpdate: vi.fn(), openFdxExportFolder: vi.fn(),
}));
const pending = (source = 'a') => ({ status: { state: 'pending' as const, exportPath: '/movie/screenplay/edit/script.fdx', acceptedSourceSha256: '0'.repeat(64), sourceSha256: source.repeat(64) }, folderActionLabel: 'Open in Finder' });
const review: FdxUpdateReview = { sourceSha256: 'a'.repeat(64), reviewFingerprint: 'b'.repeat(64), change: 'screenplay',
  beforeSceneCount: 1, afterSceneCount: 1, retainedSceneCount: 0, survivingSceneOrderChanged: false, openingChanged: false,
  removedOrReplacedScenes: [], newScenes: [], analysisNeedsRefresh: false, diagnostics: [],
};

describe('Project FDX update controller', () => {
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(readFdxUpdateStatus).mockResolvedValue(pending());
    vi.mocked(reviewFdxUpdate).mockResolvedValue(review);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('prompts once, defers in session state and prompts a new export', async () => {
    const { result } = renderHook(() => useFdxUpdate('movie', 'id'));
    await waitFor(() => expect(result.current.review).toEqual(review));
    expect(result.current.open).toBe(true);
    act(() => result.current.dismiss());
    act(() => result.current.check());
    await waitFor(() => expect(readFdxUpdateStatus).toHaveBeenCalledTimes(2));
    expect(result.current.open).toBe(false);
    const latest = { ...review, sourceSha256: 'c'.repeat(64) };
    vi.mocked(readFdxUpdateStatus).mockResolvedValue(pending('c'));
    vi.mocked(reviewFdxUpdate).mockResolvedValue(latest);
    act(() => result.current.check());
    await waitFor(() => expect(result.current.review).toEqual(latest));
    expect(result.current.open).toBe(true);
    expect(sessionStorage.getItem('renku.fdx-update.dismissed:id')).toBe(review.sourceSha256);
  });

  it('offers the latest export when an unfinished review fails without recording a deferral', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(reviewFdxUpdate).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const { result } = renderHook(() => useFdxUpdate('movie', 'id'));
    await waitFor(() => expect(reviewFdxUpdate).toHaveBeenCalledTimes(1));
    const latest = { ...review, sourceSha256: 'c'.repeat(64) };
    vi.mocked(readFdxUpdateStatus).mockResolvedValue(pending('c'));
    vi.mocked(reviewFdxUpdate).mockResolvedValue(latest);
    act(() => result.current.check());
    await waitFor(() => expect(result.current.status).toEqual(pending('c').status));
    await act(async () => reject(new StudioApiError('The exported screenplay changed.', 'SCREENPLAY_FDX_SOURCE_CHANGED', 409)));
    expect(sessionStorage.getItem('renku.fdx-update.dismissed:id')).toBeNull();
    await waitFor(() => expect(result.current.review).toEqual(latest));
    expect(result.current.open).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it('does not stack over another modal, then opens when it closes', async () => {
    const blocking = document.createElement('div'); blocking.setAttribute('role', 'dialog'); blocking.setAttribute('data-state', 'open'); document.body.append(blocking);
    const { result } = renderHook(() => useFdxUpdate('movie', 'id'));
    await waitFor(() => expect(result.current.status?.state).toBe('pending'));
    expect(result.current.open).toBe(false);
    act(() => blocking.remove());
    await waitFor(() => expect(result.current.open).toBe(true));
  });

  it('allows only one status request and ignores an old Project response', async () => {
    let resolve!: (value: ReturnType<typeof pending>) => void;
    vi.mocked(readFdxUpdateStatus).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result, rerender } = renderHook(({ id }) => useFdxUpdate(id, id), { initialProps: { id: 'first' } });
    act(() => { result.current.check(); result.current.check(); });
    expect(readFdxUpdateStatus).toHaveBeenCalledTimes(1);
    vi.mocked(readFdxUpdateStatus).mockResolvedValue({ status: { state: 'notApplicable' }, folderActionLabel: 'Open in Finder' });
    rerender({ id: 'second' });
    await waitFor(() => expect(result.current.status?.state).toBe('notApplicable'));
    await act(async () => resolve(pending()));
    expect(result.current.status?.state).toBe('notApplicable');
    expect(result.current.open).toBe(false);
  });

  it('invalidates source and material impact changes without replacing the displayed review', async () => {
    const { result } = renderHook(() => useFdxUpdate('movie', 'id'));
    await waitFor(() => expect(result.current.review).toEqual(review));
    vi.mocked(reviewFdxUpdate).mockResolvedValue({ ...review, reviewFingerprint: 'c'.repeat(64) });
    act(() => result.current.check());
    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.review).toEqual(review);
    act(() => result.current.apply());
    expect(applyFdxUpdate).not.toHaveBeenCalled();
    act(() => result.current.reviewLatest());
    await waitFor(() => expect(result.current.review?.reviewFingerprint).toBe('c'.repeat(64)));
    vi.mocked(readFdxUpdateStatus).mockResolvedValue(pending('d'));
    act(() => result.current.check());
    await waitFor(() => expect(result.current.stale).toBe(true));
  });

  it('ignores a failed verification belonging to a superseded review', async () => {
    const { result } = renderHook(() => useFdxUpdate('movie', 'id'));
    await waitFor(() => expect(result.current.review).toEqual(review));
    let reject!: (error: Error) => void;
    vi.mocked(reviewFdxUpdate).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    act(() => result.current.check());
    await waitFor(() => expect(reviewFdxUpdate).toHaveBeenCalledTimes(2));
    const latest = { ...review, reviewFingerprint: 'c'.repeat(64) };
    vi.mocked(reviewFdxUpdate).mockResolvedValue(latest);
    act(() => result.current.reviewLatest());
    await waitFor(() => expect(result.current.review).toEqual(latest));
    await act(async () => reject(new Error('Old verification failed')));
    expect(result.current.stale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('rechecks after an uncertain apply response without resubmitting', async () => {
    const { result } = renderHook(() => useFdxUpdate('movie', 'id'));
    await waitFor(() => expect(result.current.review).toEqual(review));
    vi.mocked(applyFdxUpdate).mockRejectedValue(new Error('Connection lost'));
    act(() => result.current.apply());
    await waitFor(() => expect(result.current.error).toBe('Connection lost'));
    expect(applyFdxUpdate).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(readFdxUpdateStatus).toHaveBeenCalledTimes(2));
    expect(result.current.stale).toBe(true);
  });
});
