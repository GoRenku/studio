// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneShotVideoTakeDirection } from '@gorenku/studio-core/client';
import {
  setShotVideoTakeDirection,
  type ShotVideoTakeWorkspaceMutation,
} from '@/services/studio-shot-video-takes-api';
import { Button } from '@/ui/button';
import { useTakeShotDesign } from './use-take-shot-design';

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  setShotVideoTakeDirection: vi.fn(),
}));

const SAVED_MUTATION = {
  workspace: {
    take: {
      takeId: 'take_001',
      state: {
        structure: {
          mode: 'multi-cut',
          directionsByShotId: {
            shot_001: { composition: { shotSize: 'close-up' } },
          },
        },
      },
    },
  },
  resourceKeys: [],
} as unknown as ShotVideoTakeWorkspaceMutation;

describe('useTakeShotDesign', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(setShotVideoTakeDirection).mockReset();
    vi.mocked(setShotVideoTakeDirection).mockResolvedValue(
      SAVED_MUTATION
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the saved take mutation result to its caller', async () => {
    const onSaved = vi.fn();
    render(<TakeShotDesignHarness onSaved={onSaved} />);

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Set close-up' }));

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(setShotVideoTakeDirection).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        { composition: { shotSize: 'close-up' } },
        'shot_001'
      )
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(SAVED_MUTATION));
  });

  it('flushes a pending shot-design edit when the editor unmounts', async () => {
    const { unmount } = render(<TakeShotDesignHarness />);

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Set close-up' }));

    await act(async () => {
      unmount();
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(setShotVideoTakeDirection).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        { composition: { shotSize: 'close-up' } },
        'shot_001'
      )
    );
  });

  it('saves cast direction state instead of clearing it', async () => {
    render(<TakeShotDesignHarness />);

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Set reference' }));

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(setShotVideoTakeDirection).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        {
          cast: { castMemberIds: ['cast_urban'] },
        },
        'shot_001'
      )
    );
  });
});

function TakeShotDesignHarness({
  onSaved,
}: {
  onSaved?: (result: ShotVideoTakeWorkspaceMutation) => void;
}) {
  const { update } = useTakeShotDesign({
    projectName: 'constantinople',
    sceneId: 'scene_hook',
    takeId: 'take_001',
    shotId: 'shot_001',
    initial: undefined,
    onSaved,
  });
  const setCloseUp = () => {
    const direction: SceneShotVideoTakeDirection = {
      composition: { shotSize: 'close-up' },
    };
    update(direction);
  };
  const setReference = () => {
    const direction: SceneShotVideoTakeDirection = {
      cast: { castMemberIds: ['cast_urban'] },
    };
    update(direction);
  };
  return (
    <>
      <Button type='button' onClick={setCloseUp}>
        Set close-up
      </Button>
      <Button type='button' onClick={setReference}>
        Set reference
      </Button>
    </>
  );
}
