// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render as renderTestingLibrary, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocationResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  deleteLocationAsset,
  readLocationAssets,
} from '@/services/studio-project-assets-api';
import { readLocationResource } from '@/services/studio-continuity-api';
import { LocationPanel } from './location-panel';
import { GenerationRequestInspectorProvider } from '@/features/generation-request-inspector/generation-request-inspector-provider';

function render(ui: React.ReactElement) {
  return renderTestingLibrary(
    <GenerationRequestInspectorProvider>{ui}</GenerationRequestInspectorProvider>,
  );
}

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  deleteLocationAsset: vi.fn(),
  projectAssetFileUrl: vi.fn(
    (
      projectName: string,
      assetId: string,
      fileId: string
    ) =>
      `/studio-api/projects/${projectName}/assets/${assetId}/files/${fileId}`
  ),
  readLocationAssets: vi.fn(),
}));

vi.mock('@/services/studio-continuity-api', () => ({
  readLocationResource: vi.fn(),
}));

describe('LocationPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteLocationAsset).mockReset();
    vi.mocked(readLocationAssets).mockReset();
    vi.mocked(readLocationResource).mockReset();
  });

  it('opens location details preview for the current hero image', async () => {
    vi.mocked(readLocationResource).mockResolvedValue({
      ...locationResource(),
      firstImage: {
        assetId: 'asset_location_hero',
        assetFileId: 'asset_location_hero_primary',
        title: 'Gate hero image',
        fileRole: 'primary',
        mediaKind: 'image',
        mimeType: 'image/png',
        width: 1536,
        height: 1152,
        url: '/gate-hero.png',
      },
    });
    vi.mocked(readLocationAssets).mockResolvedValue(
      assetCollection(
        [locationSheetAsset(), locationHeroAsset()],
        'asset_location_hero'
      )
    );

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Gate hero image/i,
      })
    );

    expect(
      await screen.findByRole('img', {
        name: /Gate hero image/i,
      })
    ).toBeTruthy();
  });

  it('does not fall back to a Location Sheet when no hero image exists', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue(
      assetCollection([locationSheetAsset()])
    );

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    expect(await screen.findByText('No location hero image yet')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: /Gate Location Sheet/i,
      })
    ).toBeNull();
  });

  it('opens visual content preview for the full Location Sheet only', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue(
      assetCollection([locationSheetAsset()])
    );

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Council chamber layout' })
    );

    expect(
      await screen.findByRole('img', {
        name: /Gate Location Sheet/i,
      })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show next image' })).toBeNull();
  });

  it('does not show a Location-level pick control for Location Sheets', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue(
      assetCollection([
        locationSheetAsset({ assetId: 'asset_a' }),
        locationSheetAsset({ assetId: 'asset_b' }),
      ])
    );

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();

    expect(
      screen.queryByRole('button', { name: 'Set active location sheet' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Clear active location sheet' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Generate location hero image from this sheet',
      })
    ).toBeNull();
  });

  it('deletes a location sheet only after confirmation', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets)
      .mockResolvedValueOnce(assetCollection([locationSheetAsset()]))
      .mockResolvedValueOnce(assetCollection([]));
    vi.mocked(deleteLocationAsset).mockResolvedValue('asset_location_sheet');

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete location sheet' })
    );
    expect(deleteLocationAsset).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteLocationAsset).toHaveBeenCalledWith(
        'constantinople',
        'location_gate',
        'asset_location_sheet'
      );
    });
  });
});

async function openVisualContentTab() {
  const visualContentTab = await screen.findByRole('tab', {
    name: 'Assets',
  });
  fireEvent.pointerDown(visualContentTab, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(visualContentTab);
  fireEvent.mouseDown(visualContentTab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(visualContentTab);
  fireEvent.click(visualContentTab);
}

function assetCollection(
  items: StudioAssetResponse[],
  selectedAssetId: string | null = null
) {
  return { items, selectedAssetId };
}

function locationResource(): LocationResourceResponse {
  return {
    location: {
      id: 'location_gate',
      handle: 'gate',
      name: 'Gate',
      timePeriod: '1453',
      description: 'A stone gate facing the road.',
      visualNotes: 'Weathered masonry and wind-bent grass.',
    },
  };
}

function locationSheetAsset({
  assetId = 'asset_location_sheet',
}: {
  assetId?: string;
} = {}): StudioAssetResponse {
  return locationAsset({
    assetId,
    type: 'location_sheet',
    title: 'Gate Location Sheet',
    oneLineSummary: 'Council chamber layout',
    fileRole: 'primary',
    width: 1536,
    height: 1152,
  });
}

function locationHeroAsset({
  assetId = 'asset_location_hero',
}: {
  assetId?: string;
} = {}): StudioAssetResponse {
  return locationAsset({
    assetId,
    type: 'location_hero',
    title: 'Gate hero image',
    oneLineSummary: 'Gate hero image',
    fileRole: 'primary',
    width: 1600,
    height: 900,
  });
}

function locationAsset({
  assetId,
  type,
  title,
  oneLineSummary,
  fileRole,
  width,
  height,
}: {
  assetId: string;
  type: string;
  title: string;
  oneLineSummary: string | null;
  fileRole: string;
  width: number;
  height: number;
}): StudioAssetResponse {
  return {
    id: assetId,
    owner: { kind: 'location', id: 'location_gate' },
    localeId: null,
    type,
    availability: 'ready',
    mediaKind: 'image',
    title,
    oneLineSummary,
    origin: 'generated',
    referenceName: null,
    tags: [],
    files: [
      imageFile(fileRole, `${assetId}_primary`, width, height),
    ],
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  };
}

function imageFile(
  role: string,
  id: string,
  width: number,
  height: number
): StudioAssetResponse['files'][number] {
  return {
    id,
    role,
    url: `/studio-api/projects/constantinople/assets/${id}/files/${id}`,
    mediaKind: 'image',
    mimeType: 'image/png',
    sizeBytes: 123,
    contentHash: null,
    width,
    height,
    durationSeconds: null,
  };
}
