// @vitest-environment jsdom
import React, { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedAutosave } from './use-debounced-autosave';

describe('useDebouncedAutosave', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves the latest pending value after an in-flight save settles', async () => {
    vi.useFakeTimers();
    const deferredSaves: Array<{
      value: string;
      resolve: (result: string) => void;
    }> = [];
    const onSaved = vi.fn();
    const save = vi.fn(
      (value: string) =>
        new Promise<string>((resolve) => {
          deferredSaves.push({ value, resolve });
        })
    );

    const { rerender } = renderHook(
      ({ value }) =>
        useDebouncedAutosave({
          value,
          delayMs: 10,
          save,
          onSaved,
        }),
      { initialProps: { value: '' } }
    );

    rerender({ value: 'Draft A' });
    await act(async () => {
      vi.advanceTimersByTime(10);
      await Promise.resolve();
    });
    expect(deferredSaves.map((request) => request.value)).toEqual(['Draft A']);

    rerender({ value: 'Draft B' });
    await act(async () => {
      vi.advanceTimersByTime(10);
      await Promise.resolve();
    });
    expect(deferredSaves.map((request) => request.value)).toEqual(['Draft A']);

    await act(async () => {
      deferredSaves[0]?.resolve('Saved A');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(deferredSaves.map((request) => request.value)).toEqual([
      'Draft A',
      'Draft B',
    ]);

    await act(async () => {
      deferredSaves[1]?.resolve('Saved B');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSaved).toHaveBeenCalledWith('Saved B', 'Draft B');
  });

  it('does not save the initial value when mount effects are replayed', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => 'Saved');

    renderHook(
      () =>
        useDebouncedAutosave({
          value: 'Initial',
          delayMs: 10,
          save,
        }),
      { wrapper: StrictModeWrapper }
    );

    await act(async () => {
      vi.advanceTimersByTime(20);
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('uses the caller fallback when a save rejects with a non-Error value', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {
      throw 'network failed';
    });

    const { result, rerender } = renderHook(
      ({ value }) =>
        useDebouncedAutosave({
          value,
          delayMs: 10,
          failureMessage: 'Shot settings could not be saved.',
          save,
        }),
      { initialProps: { value: 'Initial' } }
    );

    rerender({ value: 'Changed' });
    await act(async () => {
      vi.advanceTimersByTime(10);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current).toEqual({
      state: 'error',
      message: 'Shot settings could not be saved.',
    });
  });

  it('flushes a pending debounced value on unmount when requested', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (value: string) => `Saved ${value}`);

    const { rerender, unmount } = renderHook(
      ({ value }) =>
        useDebouncedAutosave({
          value,
          delayMs: 700,
          flushOnUnmount: true,
          save,
        }),
      { initialProps: { value: 'Initial' } }
    );

    rerender({ value: 'Changed' });
    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('Changed');
    expect(save).toHaveBeenCalledTimes(1);
  });
});

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}
