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

  it('shows the complete storyboard image and selects the Beat from the card', async () => {
    const onSelect = vi.fn();
    render(<SelectionHarness onSelect={onSelect} />);

    const image = await screen.findByRole('img', {
      name: 'Beat 1 - The campfire audience gathers',
    });
    expect(image.className).toContain('object-contain');
    expect(
      image.closest('[data-media-card]')?.getAttribute('style')
    ).toContain(`aspect-ratio: ${16 / 9}`);

    fireEvent.click(screen.getByRole('button', {
      name: 'Select Beat 2 - Gold becomes the true bait',
    }));

    expect(onSelect).toHaveBeenCalledWith({
      type: 'scene',
      id: 'scene-3',
      sceneTab: 'beats',
      beatId: 'beat-2',
    });
    expect(await screen.findByText('The ring becomes the answer.')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the shared large preview from the tab-owned inspect action', async () => {
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

    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());
    expect(screen.getByRole('img', {
      name: 'Beat 1 - The campfire audience gathers',
    })).not.toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

function SelectionHarness({ onSelect }: { onSelect: ReturnType<typeof vi.fn> }) {
  const [beatId, setBeatId] = React.useState<string>();
  return (
    <SceneBeatsTab
      projectName='big-fish'
      sceneId='scene-3'
      beatId={beatId}
      onSelect={(selection) => {
        if (selection.type === 'scene') {
          setBeatId(selection.beatId);
        }
        onSelect(selection);
      }}
    />
  );
}

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
      beats: [
        {
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
        },
        {
          id: 'beat-2',
          number: '2',
          title: 'Gold becomes the true bait',
          description: 'The ring becomes the answer.',
          narrativeDevelopment: 'Edward turns romance into adventure.',
          narrativePurpose: 'Connect the legend to Sandra.',
          castMemberIds: [],
          locationIds: [],
          propIds: [],
          screenplayBlockIds: [],
        },
      ],
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
      'beat-2': {
        assetId: 'asset-beat-2',
        assetFileId: 'asset-file-beat-2',
        title: 'Gold becomes the true bait',
        fileRole: 'primary',
        mediaKind: 'image',
        mimeType: 'image/png',
        width: 800,
        height: 450,
        url: '/studio-api/projects/big-fish/assets/asset-beat-2/files/asset-file-beat-2',
      },
    },
    castMemberLabels: {},
    castMemberImages: {},
    locationLabels: {},
    propLabels: {},
  };
}
