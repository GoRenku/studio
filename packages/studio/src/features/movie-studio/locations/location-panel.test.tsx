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
  selectLocationAsset,
  unselectLocationAsset,
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
  selectLocationAsset: vi.fn(),
  unselectLocationAsset: vi.fn(),
}));

vi.mock('@/services/studio-screenplay-api', () => ({
  readLocationResource: vi.fn(),
}));

describe('LocationPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteLocationAsset).mockReset();
    vi.mocked(readLocationAssets).mockReset();
    vi.mocked(readLocationResource).mockReset();
    vi.mocked(selectLocationAsset).mockReset();
    vi.mocked(unselectLocationAsset).mockReset();
  });

  it('opens location details preview for the composite sheet only', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue([
      locationSheetAsset({ selected: true }),
    ]);

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Gate environment sheet Location sheet/i,
      })
    );

    expect(
      await screen.findByRole('img', {
        name: /Gate environment sheet Location sheet/i,
      })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Show next image' })
    ).toBeNull();
    expect(screen.queryByAltText(/Front view/i)).toBeNull();
  });

  it('opens visual content preview on the composite and cycles through view files', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets).mockResolvedValue([
      locationSheetAsset({ selected: true }),
    ]);

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Active location sheet' })
    );

    expect(
      await screen.findByRole('img', {
        name: /Gate environment sheet Location sheet/i,
      })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show next image' }));

    expect(
      await screen.findByRole('img', {
        name: /Gate environment sheet Front view/i,
      })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show previous image' }));

    expect(
      await screen.findByRole('img', {
        name: /Gate environment sheet Location sheet/i,
      })
    ).toBeTruthy();
  });

  it('unselects the active location sheet when the active control is clicked again', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets)
      .mockResolvedValueOnce([locationSheetAsset({ selected: true })])
      .mockResolvedValueOnce([locationSheetAsset({ selected: false })]);
    vi.mocked(unselectLocationAsset).mockResolvedValue(
      locationSheetAsset({ selected: false })
    );

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Clear active location sheet',
      })
    );

    await waitFor(() => {
      expect(unselectLocationAsset).toHaveBeenCalledWith(
        'constantinople',
        'location_gate',
        'asset_location_sheet'
      );
    });
    expect(selectLocationAsset).not.toHaveBeenCalled();
  });

  it('selects one inactive sheet and clears the previous active sheet', async () => {
    const activeAsset = locationSheetAsset({
      assetId: 'asset_active_sheet',
      selected: true,
    });
    const inactiveAsset = locationSheetAsset({
      assetId: 'asset_inactive_sheet',
      selected: false,
    });
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets)
      .mockResolvedValueOnce([activeAsset, inactiveAsset])
      .mockResolvedValueOnce([
        { ...activeAsset, selection: { kind: 'take' } },
        { ...inactiveAsset, selection: { kind: 'select', order: 1 } },
      ]);
    vi.mocked(selectLocationAsset).mockResolvedValue({
      ...inactiveAsset,
      selection: { kind: 'select', order: 1 },
    });
    vi.mocked(unselectLocationAsset).mockResolvedValue({
      ...activeAsset,
      selection: { kind: 'take' },
    });

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    const setActiveButtons = await screen.findAllByRole('button', {
      name: 'Set active location sheet',
    });
    fireEvent.click(setActiveButtons[0]!);

    await waitFor(() => {
      expect(selectLocationAsset).toHaveBeenCalledWith(
        'constantinople',
        'location_gate',
        'asset_inactive_sheet'
      );
    });
    expect(unselectLocationAsset).toHaveBeenCalledWith(
      'constantinople',
      'location_gate',
      'asset_active_sheet'
    );
  });

  it('deletes a location sheet only after confirmation', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssets)
      .mockResolvedValueOnce([locationSheetAsset({ selected: true })])
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
  selected,
}: {
  assetId?: string;
  selected: boolean;
}): StudioAssetResponse {
  return {
    assetId,
    relationshipId: `${assetId}_relationship`,
    target: { kind: 'location', locationId: 'location_gate' },
    localeId: null,
    type: 'location_environment_sheet',
    selection: selected ? { kind: 'select', order: 0 } : { kind: 'take' },
    availability: 'ready',
    mediaKind: 'image',
    title: 'Gate environment sheet',
    oneLineSummary: null,
    origin: 'generated',
    role: 'environment_sheet',
    referenceName: null,
    purpose: null,
    sortOrder: selected ? 0 : 1,
    files: [
      imageFile('composite', `${assetId}_composite`, 1536, 1152),
      imageFile('view_front', `${assetId}_front`, 1280, 720),
      imageFile('view_right', `${assetId}_right`, 1280, 720),
      imageFile('view_back', `${assetId}_back`, 1280, 720),
      imageFile('view_left', `${assetId}_left`, 1280, 720),
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
