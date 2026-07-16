// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SequenceResourceResponse } from '@/services/studio-project-contracts';
import { readSequenceResource } from '@/services/studio-screenplay-api';
import { SequencePanel } from './sequence-panel';

vi.mock('@/services/studio-screenplay-api', () => ({
  readSequenceResource: vi.fn(),
}));

describe('SequencePanel', () => {
  beforeEach(() => {
    vi.mocked(readSequenceResource).mockReset();
  });

  it('reloads when one of its scene storyboard resources changes', async () => {
    vi.mocked(readSequenceResource).mockResolvedValue(sequenceResource());

    const { container } = render(
      <SequencePanel
        projectName='constantinople'
        sequenceId='seq_offer'
        onSelect={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: /The Sound That Opens Stone/ });
    expect(
      container
        .querySelector('[data-media-card]')
        ?.getAttribute('data-media-card-presentation')
    ).toBe('overlay');
    expect(screen.getByText('INT / NIGHT')).not.toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople',
            resourceKeys: ['scene:scene_hook'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(readSequenceResource).toHaveBeenCalledTimes(2);
    });
  });
});

function sequenceResource(): SequenceResourceResponse {
  return {
    act: {
      id: 'act_one',
      title: 'The Offer',
      sequenceCount: 1,
      sceneCount: 1,
    },
    sequence: {
      id: 'seq_offer',
      actId: 'act_one',
      number: 1,
      title: 'The Offer',
      purpose: 'Open with the bargain.',
      sceneCount: 1,
    },
    scenes: {
      items: [
        {
          id: 'scene_hook',
          sequenceId: 'seq_offer',
          title: 'The Sound That Opens Stone',
          setting: {
            interiorExterior: 'INT',
            locationIds: [],
            timeOfDay: 'NIGHT',
          },
          storyboardPreview: {
            beatSheetId: 'scene_beat_sheet_hook',
            images: [
              {
                beatId: 'beat_001',
                image: {
                  assetId: 'asset_storyboard',
                  relationshipId: 'scene_asset_storyboard',
                  assetFileId: 'asset_file_image',
                  title: 'Storyboard',
                  fileRole: 'storyboard_image',
                  mediaKind: 'image',
                  mimeType: 'image/png',
                  width: 1024,
                  height: 768,
                  url: '/storyboard.png',
                },
              },
            ],
          },
        },
      ],
      nextCursor: null,
    },
  };
}
