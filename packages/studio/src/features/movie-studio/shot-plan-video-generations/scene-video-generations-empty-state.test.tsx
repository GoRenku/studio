// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listStudioSceneShotPlans } from '@/services/studio-shot-plans-api';
import { SceneVideoGenerationsEmptyState } from './scene-video-generations-empty-state';

vi.mock('@/services/studio-shot-plans-api', () => ({ listStudioSceneShotPlans: vi.fn() }));

const props = {
  projectName: 'constantinople',
  sceneId: 'scene_opening',
  sceneHeading: 'EXT. HARBOR - DUSK',
};

describe('Generations prerequisite loading', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows a Shot Plan loading failure and retries before choosing guidance', async () => {
    let finishRetry!: (resource: Awaited<ReturnType<typeof listStudioSceneShotPlans>>) => void;
    vi.mocked(listStudioSceneShotPlans)
      .mockRejectedValueOnce(new Error('Unable to load Shot Plans.'))
      .mockReturnValueOnce(new Promise((resolve) => { finishRetry = resolve; }));

    render(<SceneVideoGenerationsEmptyState {...props} />);
    expect(screen.getByText('Loading Shot Plans...')).toBeTruthy();
    expect(await screen.findByText('Unable to load Shot Plans.')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Loading Shot Plans...')).toBeTruthy();
    expect(screen.queryByText('Unable to load Shot Plans.')).toBeNull();
    await act(async () => finishRetry({
      sceneId: props.sceneId,
      shotPlans: [],
      warnings: [],
    }));
    expect(screen.getByRole('heading', { name: 'Video takes start from a shot plan' })).toBeTruthy();
    expect(listStudioSceneShotPlans).toHaveBeenCalledTimes(2);
    expect(listStudioSceneShotPlans).toHaveBeenLastCalledWith({
      projectName: props.projectName,
      sceneId: props.sceneId,
      signal: expect.any(AbortSignal),
    });
  });
});
