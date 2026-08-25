// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaGenerationRequestInspectorContext } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { BeatStoryboardImageCandidatesDialog } from './beat-storyboard-image-candidates-dialog';
import { useBeatStoryboardImageCandidates } from './use-beat-storyboard-image-candidates';
import { selectStudioSceneStoryboardImage } from '@/services/studio-scene-storyboard-images-api';

vi.mock('./use-beat-storyboard-image-candidates');
vi.mock('@/services/studio-scene-storyboard-images-api', () => ({
  deleteStudioSceneStoryboardImage: vi.fn(),
  selectStudioSceneStoryboardImage: vi.fn(async () => undefined),
}));

describe('BeatStoryboardImageCandidatesDialog', () => {
  const reload = vi.fn();
  const inspect = vi.fn();
  const onSceneBeatsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBeatStoryboardImageCandidates).mockReturnValue({
      resource: {
        sceneId: 'scene_1',
        sceneBeatsRevisionId: 'revision_1',
        beats: [{
          beatId: 'beat_1',
          beatNumber: '1',
          selectedImageId: 'asset_1',
          needsStoryboardImage: false,
          images: [{
            id: 'asset_1',
            generationProvenance: { provider: 'fal-ai' },
            files: [{ mediaKind: 'image', url: '/image.png' }],
          }],
        }],
      } as never,
      error: null,
      reload,
    });
  });

  it('uses the existing MediaCard collection dialog even for one candidate', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Select the storyboard image shown for this Beat.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Storyboard image 1 for Decision' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {
      name: 'Inspect generation request for Storyboard image 1 for Decision',
    }));
    expect(inspect).toHaveBeenCalledWith({ projectName: 'movie', assetId: 'asset_1' });
  });

  it('delegates selection for the exact Beat candidate', async () => {
    vi.mocked(useBeatStoryboardImageCandidates).mockReturnValue({
      resource: {
        sceneId: 'scene_1',
        sceneBeatsRevisionId: 'revision_1',
        beats: [{
          beatId: 'beat_1', beatNumber: '1', selectedImageId: null,
          needsStoryboardImage: true,
          images: [{ id: 'asset_1', generationProvenance: null, files: [{ mediaKind: 'image', url: '/image.png' }] }],
        }],
      } as never,
      error: null,
      reload,
    });
    renderDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use as selected Storyboard image' }));
    });
    await vi.waitFor(() => expect(selectStudioSceneStoryboardImage).toHaveBeenCalledWith(
      expect.objectContaining({ beatId: 'beat_1', assetId: 'asset_1' }),
    ));
    expect(reload).toHaveBeenCalledOnce();
    expect(onSceneBeatsChange).toHaveBeenCalledOnce();
  });

  function renderDialog() {
    render(
      <MediaGenerationRequestInspectorContext.Provider value={{ openGenerationRequestInspector: inspect }}>
        <BeatStoryboardImageCandidatesDialog
          projectName='movie'
          sceneId='scene_1'
          sceneBeatsRevisionId='revision_1'
          beatId='beat_1'
          beatTitle='Decision'
          aspectRatio={16 / 9}
          open
          onOpenChange={() => undefined}
          onSceneBeatsChange={onSceneBeatsChange}
        />
      </MediaGenerationRequestInspectorContext.Provider>,
    );
  }
});
