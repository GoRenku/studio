// @vitest-environment jsdom
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readScreenplayBeatGalleryResource } from '@/services/screenplay';
import { ScreenplayBeatGallery } from './screenplay-beat-gallery';

vi.mock('@/services/screenplay', () => ({
  readScreenplayBeatGalleryResource: vi.fn(),
}));

vi.mock('@/hooks/use-studio-resource-refresh', () => ({
  matchesScreenplayBeatGalleryResource: vi.fn(() => false),
  useStudioResourceRefresh: vi.fn(),
}));

describe('ScreenplayBeatGallery', () => {
  beforeEach(() => {
    vi.mocked(readScreenplayBeatGalleryResource).mockResolvedValue(
      galleryResource()
    );
  });

  it('lays out complete beat images and opens the Scene from a Media Card', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ScreenplayBeatGallery
        projectName='constantinople'
        onSelect={onSelect}
      />
    );

    const image = await screen.findByRole('img', {
      name: '1 - Opening — Beat 1 — The city wakes',
    });
    expect(image.className).toContain('object-contain');
    expect(
      image.closest('[data-media-card]')?.getAttribute('style')
    ).toContain('aspect-ratio: 2');
    expect(container.querySelectorAll('[data-media-card]')).toHaveLength(3);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open 1 - Opening' })[1]!
    );
    expect(onSelect).toHaveBeenCalledWith({ type: 'scene', id: 'scene-1' });
  });

  it('opens the large shared preview from the bottom-right inspect action', async () => {
    const onSelect = vi.fn();
    render(
      <ScreenplayBeatGallery
        projectName='constantinople'
        onSelect={onSelect}
      />
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Inspect Beat 1' }))[0]!
    );

    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());
    expect(
      within(screen.getByRole('dialog')).getByRole('img', {
        name: '1 - Opening — Beat 1 — The city wakes',
      })
    ).not.toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

function galleryResource() {
  return {
    projectAspectRatio: '16:9',
    scenes: [
      {
        scene: {
          id: 'scene-1',
          productionNumber: '1',
          heading: 'EXT. CITY WALLS - DAWN',
          title: 'Opening',
        },
        beats: [
          beatImage('beat-1', '1', 'The city wakes', 1600, 800),
          beatImage('beat-2', '2', 'The siege begins', 1200, 800),
        ],
      },
      {
        scene: {
          id: 'scene-2',
          productionNumber: '2',
          heading: 'INT. COUNCIL ROOM - DAY',
          title: 'The Patron',
        },
        beats: [
          beatImage('beat-1', '1', 'The table waits', 1600, 900),
        ],
      },
    ],
  };
}

function beatImage(
  id: string,
  number: string,
  title: string,
  width: number,
  height: number
) {
  return {
    beat: { id, number, title },
    image: {
      assetId: `asset-${id}`,
      assetFileId: `file-${id}`,
      title,
      fileRole: 'primary',
      mediaKind: 'image',
      mimeType: 'image/png',
      width,
      height,
      url: `/studio-api/assets/asset-${id}`,
    },
  };
}
