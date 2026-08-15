// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoryArcResource } from '@/services/screenplay';
import { storyArcResource } from './story-arc-test-fixtures';
import { StoryArcPanel } from './story-arc-panel';

vi.mock('@/services/screenplay', () => ({
  readStoryArcResource: vi.fn(),
}));

describe('StoryArcPanel', () => {
  beforeEach(() => {
    vi.mocked(readStoryArcResource).mockReset();
  });

  it('renders the intentional no-analysis state without Scene tag fallbacks', async () => {
    vi.mocked(readStoryArcResource).mockResolvedValue(storyArcResource(false));
    render(<StoryArcPanel projectName='basilica' />);

    expect(await screen.findByText('No active screenplay analysis')).toBeTruthy();
    expect(screen.queryByText('Hook')).toBeNull();
  });

  it('refreshes the hierarchy-independent analysis resource', async () => {
    vi.mocked(readStoryArcResource)
      .mockResolvedValueOnce(storyArcResource())
      .mockResolvedValueOnce({
        ...storyArcResource(),
        project: { title: 'Updated Basilica' },
      });
    render(<StoryArcPanel projectName='basilica' />);
    expect(await screen.findByText('Basilica')).toBeTruthy();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'basilica',
            resourceKeys: ['screenplay-analysis'],
          },
        })
      );
    });

    await waitFor(() => expect(readStoryArcResource).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Updated Basilica')).toBeTruthy();
  });

  it('keeps a stale analysis visible and explains that it needs refresh', async () => {
    vi.mocked(readStoryArcResource).mockResolvedValue({
      ...storyArcResource(),
      activeAnalysisFreshness: 'needsRefresh',
      needsRefresh: true,
      freshnessHelp: 'Screenplay changed since this analysis.',
    });
    render(<StoryArcPanel projectName='basilica' />);

    const badge = await screen.findByText('Needs refresh');
    expect(badge).toBeTruthy();
    expect(screen.getByText('The Offer')).toBeTruthy();
  });

  it('keeps historical analysis prose readable when its Scene no longer exists', async () => {
    const resource = storyArcResource();
    resource.activeAnalysis!.actSegments[0]!.sceneIds = ['scene_removed'];
    resource.activeAnalysis!.sceneAnalyses[0]!.sceneId = 'scene_removed';
    vi.mocked(readStoryArcResource).mockResolvedValue(resource);

    render(<StoryArcPanel projectName='basilica' />);

    expect(await screen.findByText('The Offer')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {
      name: 'Open analysis for scene: Unavailable historical Scene',
    }));
    expect(screen.getByText('The cannon faces the city.')).toBeTruthy();
  });
});
