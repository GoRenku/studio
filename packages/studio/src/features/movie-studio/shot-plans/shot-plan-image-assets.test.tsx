// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaGenerationRequestInspectorContext } from '@/features/media-generation-request/use-media-generation-request-inspector';
import { ShotPlanImageAssetsView } from './shot-plan-image-assets';
import { useShotPlanImageAssets } from './use-shot-plan-image-assets';
import { deleteStudioShotPlanImageAsset } from '@/services/studio-shot-plans-api';

vi.mock('./use-shot-plan-image-assets');
vi.mock('@/services/studio-shot-plans-api', () => ({
  deleteStudioShotPlanImageAsset: vi.fn(async () => undefined),
}));

describe('ShotPlanImageAssetsView', () => {
  const reload = vi.fn();
  const inspect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useShotPlanImageAssets).mockReturnValue({
      resource: {
        groups: [{
          role: 'reference',
          assets: [{
            id: 'asset_1', title: 'Plan reference',
            generationProvenance: { provider: 'fal-ai' },
            files: [{ mediaKind: 'image', url: '/reference.png' }],
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
        <ShotPlanImageAssetsView projectName='movie' shotPlanId='plan_1' />
      </MediaGenerationRequestInspectorContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Reference Images' })).toBeTruthy();
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
    await vi.waitFor(() => expect(deleteStudioShotPlanImageAsset).toHaveBeenCalledWith({
      projectName: 'movie', shotPlanId: 'plan_1', assetId: 'asset_1',
    }));
  });
});
