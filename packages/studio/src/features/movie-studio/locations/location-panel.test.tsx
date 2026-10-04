// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render as renderTestingLibrary, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LocationResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import {
  deleteLocationAssetFile,
  readLocationAssetFiles,
} from '@/services/studio-project-assets-api';
import { readLocationResource } from '@/services/studio-continuity-api';
import { LocationPanel } from './location-panel';
import { MediaGenerationRequestInspectorProvider as GenerationRequestInspectorProvider } from '@/features/media-generation-request/media-generation-request-inspector-provider';

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
  deleteLocationAssetFile: vi.fn(),
  projectAssetFileUrl: vi.fn(
    (
      projectName: string,
      assetFileId: string
    ) =>
      `/studio-api/projects/${projectName}/asset-files/${assetFileId}`
  ),
  readLocationAssetFiles: vi.fn(),
}));

vi.mock('@/services/studio-continuity-api', () => ({
  readLocationResource: vi.fn(),
}));

vi.mock('./spark-location-world-viewer', () => ({
  SparkLocationWorldViewer: ({ url }: { url: string }) => (
    <div data-testid='spark-viewer' data-url={url} />
  ),
}));

describe('LocationPanel', () => {
  beforeEach(() => {
    vi.mocked(deleteLocationAssetFile).mockReset();
    vi.mocked(readLocationAssetFiles).mockReset();
    vi.mocked(readLocationResource).mockReset();
  });

  it('opens location details preview for the current hero image', async () => {
    vi.mocked(readLocationResource).mockResolvedValue({
      ...locationResource(),
      firstImage: {
        assetFileId: 'asset_location_hero_primary',
        title: 'Gate hero image',

        mediaKind: 'image',
        mimeType: 'image/png',
        width: 1536,
        height: 1152,
        url: '/gate-hero.png',
      },
    });
    vi.mocked(readLocationAssetFiles).mockResolvedValue(
      assetFileCollection(
        [locationSheetAssetFile(), locationHeroAssetFile()],
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
    vi.mocked(readLocationAssetFiles).mockResolvedValue(
      assetFileCollection([locationSheetAssetFile()])
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
    vi.mocked(readLocationAssetFiles).mockResolvedValue(
      assetFileCollection([locationSheetAssetFile()])
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
    vi.mocked(readLocationAssetFiles).mockResolvedValue(
      assetFileCollection([
        locationSheetAssetFile({ assetFileId: 'asset_a' }),
        locationSheetAssetFile({ assetFileId: 'asset_b' }),
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

  it('adds a display-only 3D World tab backed by the selected local Asset file', async () => {
    vi.mocked(readLocationResource).mockResolvedValue({
      ...locationResource(),
      selectedWorld: locationWorldAssetFile(),
    });
    vi.mocked(readLocationAssetFiles).mockResolvedValue(assetFileCollection([]));

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    expect((await screen.findAllByRole('tab')).map((tab) => tab.textContent)).toEqual([
      'Details',
      'Assets',
      '3D World',
    ]);
    const worldTab = screen.getByRole('tab', { name: '3D World' });
    fireEvent.pointerDown(worldTab, { button: 0, ctrlKey: false });
    fireEvent.pointerUp(worldTab);
    fireEvent.mouseDown(worldTab, { button: 0, ctrlKey: false });
    fireEvent.mouseUp(worldTab);
    fireEvent.click(worldTab);
    expect((await screen.findByTestId('spark-viewer')).getAttribute('data-url')).toBe(
      '/studio-api/projects/constantinople/asset-files/asset_location_world_primary'
    );
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
  });

  it('deletes a location sheet only after confirmation', async () => {
    vi.mocked(readLocationResource).mockResolvedValue(locationResource());
    vi.mocked(readLocationAssetFiles)
      .mockResolvedValueOnce(assetFileCollection([locationSheetAssetFile()]))
      .mockResolvedValueOnce(assetFileCollection([]));
    vi.mocked(deleteLocationAssetFile).mockResolvedValue({
      valid: true,
      warnings: [],
      project: {
        projectName: 'constantinople',
        id: 'project_1',
        projectFolder: '/projects/constantinople',
      },
      changes: [
        { type: 'asset.discarded', assetFileId: 'asset_location_sheet' },
      ],
      recovery: {
        operationId: 'trash_operation_1',
        trashItemIds: ['trash_item_1'],
        restorable: true,
        restoreCommand: {
          name: 'trash.restore',
          trashItemId: 'trash_item_1',
        },
      },
      resourceKeys: ['surface:location:location_gate', 'trash:list'],
    });

    render(
      <LocationPanel projectName='constantinople' locationId='location_gate' />
    );

    await openVisualContentTab();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete location sheet' })
    );
    expect(deleteLocationAssetFile).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteLocationAssetFile).toHaveBeenCalledWith(
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

function assetFileCollection(
  items: StudioAssetFileResponse[],
  selectedAssetFileId: string | null = null
) {
  return { items, selectedAssetFileId };
}

function locationResource(): LocationResourceResponse {
  return {
    selectedWorld: null,
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

function locationSheetAssetFile({
  assetFileId = 'asset_location_sheet',
}: {
  assetFileId?: string;
} = {}): StudioAssetFileResponse {
  return locationAssetFile({
    assetFileId,
    type: 'location_sheet',
    title: 'Gate Location Sheet',
    oneLineSummary: 'Council chamber layout',

    width: 1536,
    height: 1152,
  });
}

function locationHeroAssetFile({
  assetFileId = 'asset_location_hero',
}: {
  assetFileId?: string;
} = {}): StudioAssetFileResponse {
  return locationAssetFile({
    assetFileId,
    type: 'location_hero',
    title: 'Gate hero image',
    oneLineSummary: 'Gate hero image',

    width: 1600,
    height: 900,
  });
}

function locationWorldAssetFile(): StudioAssetFileResponse {
  return {
    id: 'asset_location_world_primary',
    owner: { kind: 'location', id: 'location_gate' },
    localeId: null,
    type: 'location_world',
    availability: 'ready',
    mediaKind: 'model',
    title: 'Gate 3D World',
    oneLineSummary: null,
    origin: 'world-labs',
    generationProvenance: null,
    authoredFrom: null,
    referenceName: null,
    tags: [],
    url: '/studio-api/projects/constantinople/asset-files/asset_location_world_primary', mimeType: 'application/octet-stream', sizeBytes: 123, contentHash: 'hash', width: null, height: null, durationSeconds: null,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

function locationAssetFile({
  assetFileId,
  type,
  title,
  oneLineSummary,
  width,
  height,
}: {
  assetFileId: string;
  type: string;
  title: string;
  oneLineSummary: string | null;

  width: number;
  height: number;
}): StudioAssetFileResponse {
  return {
    id: assetFileId,
    owner: { kind: 'location', id: 'location_gate' },
    localeId: null,
    type,
    availability: 'ready',
    mediaKind: 'image',
    title,
    oneLineSummary,
    origin: 'generated',
    generationProvenance: null,
    authoredFrom: null,
    referenceName: null,
    tags: [],
    url: `/studio-api/projects/constantinople/asset-files/${assetFileId}`,
    mimeType: 'image/png', sizeBytes: 123, contentHash: null, width, height, durationSeconds: null,
    createdAt: '2026-05-28T00:00:00.000Z',
    updatedAt: '2026-05-28T00:00:00.000Z',
  };
}
