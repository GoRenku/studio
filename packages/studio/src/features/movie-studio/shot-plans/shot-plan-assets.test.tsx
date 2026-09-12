// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaGenerationRequestInspectorContext } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { ShotPlanAssetsView } from './shot-plan-assets';
import { useShotPlanAssets } from './use-shot-plan-assets';
import { deleteStudioShotPlanAsset } from '@/services/studio-shot-plans-api';

vi.mock('./use-shot-plan-assets');
vi.mock('@/ui/slider', () => ({ Slider: () => null }));
vi.mock('@/services/studio-shot-plans-api', () => ({
  deleteStudioShotPlanAsset: vi.fn(async () => undefined),
}));

describe('ShotPlanAssetsView', () => {
  const reload = vi.fn();
  const inspect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useShotPlanAssets).mockReturnValue({
      resource: {
        groups: [{
          role: 'reference',
          assets: [{
            id: 'asset_1', title: 'Plan reference',
            generationProvenance: { provider: 'fal-ai' },
            files: [{ role: 'primary', mediaKind: 'image', url: '/reference.png' }],
          }],
        }],
      } as never,
      error: null,
      reload,
    });
  });

  it('groups exact Plan images in existing MediaCards with inspection and discard', async () => {
    render(
      <MediaGenerationRequestInspectorContext.Provider value={{ openGenerationRequestInspector: inspect }}>
        <ShotPlanAssetsView projectName='movie' shotPlanId='plan_1' />
      </MediaGenerationRequestInspectorContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'References' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Plan reference' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {
      name: 'Inspect generation request for Plan reference',
    }));
    expect(inspect).toHaveBeenCalledWith({ projectName: 'movie', assetId: 'asset_1' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Plan reference' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    await vi.waitFor(() => expect(deleteStudioShotPlanAsset).toHaveBeenCalledWith({
      projectName: 'movie', shotPlanId: 'plan_1', assetId: 'asset_1',
    }));
  });

  it('offers video and audio playback for imported references without generation inspection', () => {
    vi.mocked(useShotPlanAssets).mockReturnValue({ resource: { groups: [{ role: 'reference', assets: [
      { id: 'video', title: 'Previs excerpt', generationProvenance: null, files: [{ role: 'primary', mediaKind: 'video', url: '/excerpt.mp4' }] },
      { id: 'audio', title: 'Urban delivery', generationProvenance: null, files: [{ role: 'primary', mediaKind: 'audio', url: '/delivery.wav' }] },
    ] }] } as never, error: null, reload });
    render(<MediaGenerationRequestInspectorContext.Provider value={{ openGenerationRequestInspector: inspect }}>
      <ShotPlanAssetsView projectName='movie' shotPlanId='plan_1' />
    </MediaGenerationRequestInspectorContext.Provider>);
    expect(document.querySelector('audio')?.getAttribute('src')).toBe('/delivery.wav');
    expect(screen.queryByRole('button', { name: /Inspect generation request/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Preview Previs excerpt' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('dialog').querySelector('video')?.getAttribute('src')).toBe('/excerpt.mp4');
  });
});
