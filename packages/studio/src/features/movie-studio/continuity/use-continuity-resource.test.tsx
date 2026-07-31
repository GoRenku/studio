// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useContinuityResource } from './use-continuity-resource';

describe('useContinuityResource', () => {
  it('clears a transient error when a refresh succeeds', async () => {
    const read = vi
      .fn<() => Promise<{ name: string }>>()
      .mockRejectedValueOnce(new Error('Temporary request failure'))
      .mockResolvedValueOnce({ name: 'Field Cannon' });
    const { result } = renderHook(() =>
      useContinuityResource({
        read,
        fallbackErrorMessage: 'Unable to load Prop.',
      })
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Temporary request failure');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.resource).toEqual({ name: 'Field Cannon' });
    expect(result.current.error).toBeNull();
  });
});
