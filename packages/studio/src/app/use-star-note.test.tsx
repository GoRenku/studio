// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStarNote } from './use-star-note';

const offerStarNoteMock = vi.hoisted(() => vi.fn());

vi.mock('./star-note', () => ({ offerStarNote: offerStarNoteMock }));

async function changeResources(projectName: string) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent('renku:studio-resource-changed', {
      detail: { projectName, resourceKeys: ['asset-files'] },
    }));
  });
}

describe('useStarNote', () => {
  afterEach(() => {
    cleanup();
    offerStarNoteMock.mockReset();
  });

  it('asks on project open and again when the open project changes', async () => {
    offerStarNoteMock.mockResolvedValue(false);
    await act(async () => {
      renderHook(() => useStarNote('night-market'));
    });

    expect(offerStarNoteMock).toHaveBeenCalledTimes(1);
    await changeResources('other-project');
    expect(offerStarNoteMock).toHaveBeenCalledTimes(1);
    await changeResources('night-market');
    expect(offerStarNoteMock).toHaveBeenCalledTimes(2);
    expect(offerStarNoteMock).toHaveBeenLastCalledWith('night-market');
  });

  it('stops asking once the note was shown', async () => {
    offerStarNoteMock.mockResolvedValue(true);
    await act(async () => {
      renderHook(() => useStarNote('night-market'));
    });

    await changeResources('night-market');

    expect(offerStarNoteMock).toHaveBeenCalledTimes(1);
  });

  it('does not ask without an open project', async () => {
    await act(async () => {
      renderHook(() => useStarNote(null));
    });

    expect(offerStarNoteMock).not.toHaveBeenCalled();
  });
});
