// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSceneBeatsResource } from '@/services/screenplay';
import { SceneShotPlansEmptyState } from './scene-shot-plans-empty-state';

vi.mock('@/services/screenplay', () => ({ readSceneBeatsResource: vi.fn() }));

const props = {
  projectName: 'constantinople',
  sceneId: 'scene_opening',
  sceneHeading: 'EXT. HARBOR - DUSK',
};

describe('Shot Plans prerequisite loading', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows a Beat loading failure and retries before choosing guidance', async () => {
    let finishRetry!: (resource: Awaited<ReturnType<typeof readSceneBeatsResource>>) => void;
    vi.mocked(readSceneBeatsResource)
      .mockRejectedValueOnce(new Error('Unable to load Scene Beats.'))
      .mockReturnValueOnce(new Promise((resolve) => { finishRetry = resolve; }));

    render(<SceneShotPlansEmptyState {...props} />);
    expect(screen.getByText('Loading Scene Beats...')).toBeTruthy();
    expect(await screen.findByText('Unable to load Scene Beats.')).toBeTruthy();
    expect(screen.queryByText(/This scene has no beats yet/)).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Loading Scene Beats...')).toBeTruthy();
    expect(screen.queryByText('Unable to load Scene Beats.')).toBeNull();
    await act(async () => finishRetry({ activeRevision: { beats: [{ id: 'beat_one' }] } } as Awaited<ReturnType<typeof readSceneBeatsResource>>));
    expect(screen.getByRole('heading', { name: 'No shot plans yet' })).toBeTruthy();
    expect(readSceneBeatsResource).toHaveBeenCalledTimes(2);
    expect(readSceneBeatsResource).toHaveBeenLastCalledWith(props.projectName, props.sceneId);
  });

  it.each([null, { beats: [] }])('recommends Beats only after a successful empty response (%j)', async (activeRevision) => {
    vi.mocked(readSceneBeatsResource).mockResolvedValue({ activeRevision } as Awaited<ReturnType<typeof readSceneBeatsResource>>);
    render(<SceneShotPlansEmptyState {...props} />);
    expect(await screen.findByRole('heading', { name: 'Shot plans start from beats' })).toBeTruthy();
  });

  it('waits for the new Scene instead of using the previous Scene’s Beats', async () => {
    vi.mocked(readSceneBeatsResource)
      .mockResolvedValueOnce({ activeRevision: { beats: [{ id: 'beat_one' }] } } as Awaited<ReturnType<typeof readSceneBeatsResource>>)
      .mockResolvedValueOnce({ activeRevision: null } as Awaited<ReturnType<typeof readSceneBeatsResource>>);
    const { rerender } = render(<SceneShotPlansEmptyState {...props} />);
    expect(await screen.findByRole('heading', { name: 'No shot plans yet' })).toBeTruthy();
    rerender(<SceneShotPlansEmptyState {...props} sceneId='scene_second' />);
    expect(screen.getByText('Loading Scene Beats...')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Shot plans start from beats' })).toBeTruthy();
  });
});
