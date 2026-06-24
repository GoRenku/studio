// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneShotVideoTakeShotDesign } from '@gorenku/studio-core/client';
import {
  updateSceneShotVideoTakeShotDesign,
  type ShotVideoTakeProductionMutation,
} from '@/services/studio-shot-video-takes-api';
import { Button } from '@/ui/button';
import { useTakeShotDesign } from './use-take-shot-design';

vi.mock('@/services/studio-shot-video-takes-api', () => ({
  updateSceneShotVideoTakeShotDesign: vi.fn(),
}));

const SAVED_MUTATION = {
  context: {
    take: {
      takeId: 'take_001',
      state: {
        shotDesignByShotId: {
          shot_001: { composition: { shotSize: 'close-up' } },
        },
      },
    },
  },
  resourceKeys: [],
} as unknown as ShotVideoTakeProductionMutation;

describe('useTakeShotDesign', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(updateSceneShotVideoTakeShotDesign).mockReset();
    vi.mocked(updateSceneShotVideoTakeShotDesign).mockResolvedValue(
      SAVED_MUTATION
    );
  });

  it('reports the saved take mutation result to its caller', async () => {
    const onSaved = vi.fn();
    render(<TakeShotDesignHarness onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Set close-up' }));

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShotDesign).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        'shot_001',
        { composition: { shotSize: 'close-up' } }
      )
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(SAVED_MUTATION));
  });

  it('flushes a pending shot-design edit when the editor unmounts', async () => {
    const { unmount } = render(<TakeShotDesignHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Set close-up' }));
    unmount();

    await waitFor(() =>
      expect(updateSceneShotVideoTakeShotDesign).toHaveBeenCalledWith(
        'constantinople',
        'scene_hook',
        'take_001',
        'shot_001',
        { composition: { shotSize: 'close-up' } }
      )
    );
  });
});

function TakeShotDesignHarness({
  onSaved,
}: {
  onSaved?: (result: ShotVideoTakeProductionMutation) => void;
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
    const shotDesign: SceneShotVideoTakeShotDesign = {
      composition: { shotSize: 'close-up' },
    };
    update(shotDesign);
  };
  return (
    <Button type='button' onClick={setCloseUp}>
      Set close-up
    </Button>
  );
}
