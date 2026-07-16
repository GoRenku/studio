// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActStoryboardResourceResponse } from '@/services/studio-project-contracts';
import { readActStoryboardResource } from '@/services/studio-screenplay-api';
import { ActStoryboardPanel } from './act-storyboard-panel';

vi.mock('@/services/studio-screenplay-api', () => ({
  readActStoryboardResource: vi.fn(),
}));

describe('ActStoryboardPanel', () => {
  beforeEach(() => {
    vi.mocked(readActStoryboardResource).mockReset();
  });

  it('groups scenes by sequence and renders Beats in order', async () => {
    vi.mocked(readActStoryboardResource).mockResolvedValue(actResource());

    const { container } = render(
      <ActStoryboardPanel
        projectName='constantinople'
        actId='act_one'
        onSelect={vi.fn()}
      />
    );

    const beatButtons = await screen.findAllByRole('button', {
      name: /^Beat \d+ —/,
    });
    expect(beatButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Beat 1 — Map study',
      'Beat 2 — Council reaction',
    ]);
    expect(
      container.querySelectorAll(
        '[data-media-card-presentation="overlay"]'
      )
    ).toHaveLength(2);
  });

  it('renders exactly one placeholder slot for scenes without storyboards', async () => {
    vi.mocked(readActStoryboardResource).mockResolvedValue(actResource());

    render(
      <ActStoryboardPanel
        projectName='constantinople'
        actId='act_one'
        onSelect={vi.fn()}
      />
    );

    const placeholders = await screen.findAllByRole('button', {
      name: 'Open scene beats',
    });
    expect(placeholders).toHaveLength(1);
  });

  it('navigates to the selected Beat', async () => {
    const onSelect = vi.fn();
    vi.mocked(readActStoryboardResource).mockResolvedValue(actResource());

    render(
      <ActStoryboardPanel
        projectName='constantinople'
        actId='act_one'
        onSelect={onSelect}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Beat 1 — Map study' }));
    expect(onSelect).toHaveBeenCalledWith({
      type: 'scene',
      id: 'scene_hook',
      sceneTab: 'beats',
      beatId: 'beat_001',
    });
  });

  it('reloads when a scene storyboard resource changes', async () => {
    vi.mocked(readActStoryboardResource).mockResolvedValue(actResource());

    render(
      <ActStoryboardPanel
        projectName='constantinople'
        actId='act_one'
        onSelect={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: 'Beat 1 — Map study' });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: ['surface:scene:scene_hook:beats'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(readActStoryboardResource).toHaveBeenCalledTimes(2);
    });
  });
});

function image(suffix: string) {
  return {
    assetId: `asset_${suffix}`,
    relationshipId: `rel_${suffix}`,
    assetFileId: `file_${suffix}`,
    title: 'Storyboard',
    fileRole: 'shot',
    mediaKind: 'image',
    mimeType: 'image/png',
    width: 1024,
    height: 768,
    url: `/img/${suffix}`,
  };
}

function actResource(): ActStoryboardResourceResponse {
  return {
    act: {
      id: 'act_one',
      title: 'The Offer',
      purpose: 'Open with the bargain.',
      sequenceCount: 1,
      sceneCount: 2,
    },
    sequences: [
      {
        sequence: {
          id: 'seq_offer',
          actId: 'act_one',
          number: 1,
          title: 'The Sound That Opens Stone',
          sceneCount: 2,
        },
        scenes: [
          {
            scene: {
              id: 'scene_hook',
              sequenceId: 'seq_offer',
              title: 'The Sound That Opens Stone',
            },
            beats: [
              {
                beatId: 'beat_001',
                label: 'Beat 1',
                title: 'Map study',
                image: image('001'),
              },
              {
                beatId: 'beat_002',
                label: 'Beat 2',
                title: 'Council reaction',
                image: image('002'),
              },
            ],
          },
          {
            scene: {
              id: 'scene_offer',
              sequenceId: 'seq_offer',
              title: 'The Emperor Without Coin',
            },
            beats: [],
          },
        ],
      },
    ],
  };
}
