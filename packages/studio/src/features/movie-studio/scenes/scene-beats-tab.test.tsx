// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSceneBeatsResource } from '@/services/screenplay';
import { SceneBeatsTab } from './scene-beats-tab';

vi.mock('@/services/screenplay', () => ({
  readSceneBeatsResource: vi.fn(),
}));

vi.mock('@/hooks/use-studio-resource-refresh', () => ({
  matchesSceneBeatsResource: vi.fn(() => false),
  useStudioResourceRefresh: vi.fn(),
}));

describe('SceneBeatsTab', () => {
  beforeEach(() => {
    vi.mocked(readSceneBeatsResource).mockResolvedValue(sceneBeatsResource());
  });

  it('shows the complete storyboard image and opens the shared large preview', async () => {
    render(
      <SceneBeatsTab
        projectName='big-fish'
        sceneId='scene-3'
        onSelect={vi.fn()}
      />
    );

    const image = await screen.findByRole('img', {
      name: 'Beat 1 - The campfire audience gathers',
    });
    expect(image.className).toContain('object-contain');
    expect(
      image.closest('[data-media-card]')?.getAttribute('style')
    ).toContain(`aspect-ratio: ${16 / 9}`);

    fireEvent.click(screen.getByRole('button', {
      name: 'Preview Beat 1 - The campfire audience gathers',
    }));
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByRole('img', {
      name: 'Beat 1 - The campfire audience gathers',
    })).not.toBeNull();
  });

  it('keeps Beat selection on the standard inspect action', async () => {
    const onSelect = vi.fn();
    render(
      <SceneBeatsTab
        projectName='big-fish'
        sceneId='scene-3'
        onSelect={onSelect}
      />
    );

    fireEvent.click(await screen.findByRole('button', {
      name: 'Inspect Beat 1',
    }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({
      type: 'scene',
      id: 'scene-3',
      sceneTab: 'beats',
      beatId: 'beat-1',
    }));
  });
});

function sceneBeatsResource() {
  return {
    scene: {
      scene: {
        id: 'scene-3',
        heading: 'EXT. CAMPSITE - NIGHT',
        blocks: [],
      },
      references: [],
    },
    sections: [],
    projectAspectRatio: '16:9',
    activeRevisionId: 'revision-1',
    activeRevision: {
      sceneId: 'scene-3',
      beats: [{
        id: 'beat-1',
        number: '1',
        title: 'The campfire audience gathers',
        description: 'The group gathers around Edward.',
        narrativeDevelopment: 'The private story becomes public folklore.',
        narrativePurpose: 'Show Edward commanding an audience.',
        castMemberIds: [],
        locationIds: [],
        propIds: [],
        screenplayBlockIds: [],
      }],
    },
    storyboardImagesByBeatId: {
      'beat-1': {
        assetId: 'asset-beat-1',
        assetFileId: 'asset-file-beat-1',
        title: 'The campfire audience gathers',
        fileRole: 'primary',
        mediaKind: 'image',
        mimeType: 'image/png',
        width: 695,
        height: 755,
        url: '/studio-api/projects/big-fish/assets/asset-beat-1/files/asset-file-beat-1',
      },
    },
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
    propLabels: {},
  };
}
