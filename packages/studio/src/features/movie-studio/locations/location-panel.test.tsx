// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocationResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  deleteLocationAsset,
  readLocationAssets,
} from '@/services/studio-project-assets-api';
import { readLocationResource } from '@/services/studio-screenplay-api';
import { LocationPanel } from './location-panel';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  deleteLocationAsset: vi.fn(),
  locationAssetFileUrl: vi.fn(
    (
      projectName: string,
      locationId: string,
      assetId: string,
      fileId: string
    ) =>
      `/studio-api/projects/${projectName}/locations/${locationId}/assets/${assetId}/files/${fileId}`
  ),
  readLocationAssets: vi.fn(),
}));

vi.mock('@/services/studio-screenplay-api', () => ({
  readLocationResource: vi.fn(),
}));

describe('LocationPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteLocationAsset).mockReset();
    vi.mocked(readLocationAssets).mockReset();
    vi.mocked(readLocationResource).mockReset();
  });

  it('opens location details preview for the current hero image', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue([
      locationSheetAsset(),
      locationHeroAsset({ selected: true }),
    ]);

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
    vi.mocked(readLocationAssets).mockResolvedValue([locationSheetAsset()]);

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    expect(await screen.findByText('No location hero image yet')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: /Gate environment sheet/i,
      })
    ).toBeNull();
  });

  it('opens visual content preview for the full Location Sheet only', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue([locationSheetAsset()]);

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Council chamber layout' })
    );

    expect(
      await screen.findByRole('img', {
        name: /Gate environment sheet/i,
      })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show next image' })).toBeNull();
  });

  it('does not show a Location-level pick control for Location Sheets', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue(
      [locationSheetAsset({ assetId: 'asset_a' }), locationSheetAsset({ assetId: 'asset_b' })]
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
      .mockResolvedValueOnce([locationSheetAsset()])
      .mockResolvedValueOnce([]);
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
    name: 'Visual Content',
  });
  fireEvent.pointerDown(visualContentTab, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(visualContentTab);
  fireEvent.mouseDown(visualContentTab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(visualContentTab);
  fireEvent.click(visualContentTab);
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
    type: 'location_environment_sheet',
    role: 'environment_sheet',
    title: 'Gate environment sheet',
    oneLineSummary: 'Council chamber layout',
    fileRole: 'primary',
    selected: false,
    width: 1536,
    height: 1152,
  });
}

function locationHeroAsset({
  assetId = 'asset_location_hero',
  selected,
}: {
  assetId?: string;
  selected: boolean;
}): StudioAssetResponse {
  return locationAsset({
    assetId,
    type: 'location_hero',
    role: 'hero',
    title: 'Gate hero image',
    oneLineSummary: 'Gate hero image',
    fileRole: 'primary',
    selected,
    width: 1600,
    height: 900,
  });
}

function locationAsset({
  assetId,
  type,
  role,
  title,
  oneLineSummary,
  fileRole,
  selected,
  width,
  height,
}: {
  assetId: string;
  type: string;
  role: string;
  title: string;
  oneLineSummary: string | null;
  fileRole: string;
  selected: boolean;
  width: number;
  height: number;
}): StudioAssetResponse {
  return {
    assetId,
    relationshipId: `${assetId}_relationship`,
    target: { kind: 'location', locationId: 'location_gate' },
    localeId: null,
    type,
    selection: selected ? { kind: 'select', order: 0 } : { kind: 'take' },
    availability: 'ready',
    mediaKind: 'image',
    title,
    oneLineSummary,
    origin: 'generated',
    role,
    referenceName: null,
    purpose: null,
    sortOrder: selected ? 0 : 1,
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
    projectRelativePath: `locations/gate/${id}.png` as never,
    mediaKind: 'image',
    mimeType: 'image/png',
    sizeBytes: 123,
    contentHash: null,
    width,
    height,
    durationSeconds: null,
  };
}
