// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { Asset, CastMember } from '@gorenku/studio-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCastAssets } from '@/services/studio-project-assets-api';
import { useCastDesignAssets } from './use-cast-design-assets';

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: (
    projectName: string,
    castMemberId: string,
    assetId: string,
    assetFileId: string
  ) => `/projects/${projectName}/cast/${castMemberId}/assets/${assetId}/files/${assetFileId}`,
  readCastAssets: vi.fn(),
  selectCastAsset: vi.fn(),
  unselectCastAsset: vi.fn(),
}));

describe('useCastDesignAssets', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders eager initial assets without fetching cast assets', () => {
    vi.mocked(readCastAssets).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useCastDesignAssets({
        projectName: 'constantinople-eager',
        castEntry: castMember,
        initialAssets: [
          castAsset({
            assetId: 'asset_selected_sheet',
            role: 'character_sheet',
            selection: { kind: 'select', order: 1 },
          }),
        ],
      })
    );

    expect(result.current.isLoadingCastAssets).toBe(false);
    expect(readCastAssets).not.toHaveBeenCalled();
    expect(result.current.characterSheetContent.selectedAssets).toEqual([
      expect.objectContaining({
        assetId: 'asset_selected_sheet',
        selected: true,
      }),
    ]);
  });

  it('syncs local state when eager assets refresh while the panel stays mounted', async () => {
    const { result, rerender } = renderHook(
      ({ initialAssets }: { initialAssets: Asset[] }) =>
        useCastDesignAssets({
          projectName: 'constantinople-refresh',
          castEntry: castMember,
          initialAssets,
        }),
      {
        initialProps: {
          initialAssets: [
            castAsset({
              assetId: 'asset_old_take',
              role: 'character_sheet',
              selection: { kind: 'take' },
            }),
          ],
        },
      }
    );

    expect(result.current.characterSheetContent.takes).toEqual([
      expect.objectContaining({ assetId: 'asset_old_take' }),
    ]);

    rerender({
      initialAssets: [
        castAsset({
          assetId: 'asset_refreshed_selected',
          role: 'character_sheet',
          selection: { kind: 'select', order: 1 },
        }),
      ],
    });

    await waitFor(() => {
      expect(result.current.characterSheetContent.selectedAssets).toEqual([
        expect.objectContaining({ assetId: 'asset_refreshed_selected' }),
      ]);
    });
    expect(result.current.characterSheetContent.takes).toEqual([]);
    expect(readCastAssets).not.toHaveBeenCalled();
  });

  it('treats eager empty assets as known empty state', () => {
    const { result } = renderHook(() =>
      useCastDesignAssets({
        projectName: 'constantinople-empty',
        castEntry: castMember,
        initialAssets: [],
      })
    );

    expect(result.current.isLoadingCastAssets).toBe(false);
    expect(result.current.characterSheetContent.selectedAssets).toEqual([]);
    expect(result.current.characterSheetContent.takes).toEqual([]);
    expect(readCastAssets).not.toHaveBeenCalled();
  });

  it('fetches cast assets when eager data is unavailable', async () => {
    vi.mocked(readCastAssets).mockResolvedValue([
      castAsset({
        assetId: 'asset_fetched_sheet',
        role: 'character_sheet',
        selection: { kind: 'take' },
      }),
    ]);

    const { result } = renderHook(() =>
      useCastDesignAssets({
        projectName: 'constantinople-fetch',
        castEntry: castMember,
      })
    );

    await waitFor(() => {
      expect(result.current.characterSheetContent.takes).toEqual([
        expect.objectContaining({ assetId: 'asset_fetched_sheet' }),
      ]);
    });
    expect(result.current.isLoadingCastAssets).toBe(false);
    expect(readCastAssets).toHaveBeenCalledWith('constantinople-fetch', 'cast_1');
  });
});

const castMember: CastMember = {
  id: 'cast_1',
  name: 'Anna Komnene',
  shortDescription: 'A sharp court historian.',
};

function castAsset(input: {
  assetId: string;
  role: string;
  selection: Asset['selection'];
}): Asset {
  return {
    assetId: input.assetId,
    relationshipId: `${input.assetId}_relationship`,
    target: { kind: 'castMember', castMemberId: castMember.id },
    localeId: null,
    type: 'generated',
    selection: input.selection,
    availability: 'ready',
    mediaKind: 'image',
    title: input.assetId,
    oneLineSummary: null,
    origin: 'test',
    role: input.role,
    sortOrder: 1,
    files: [
      {
        id: `${input.assetId}_file`,
        role: 'primary',
        projectRelativePath: `assets/${input.assetId}.png` as Asset['files'][number]['projectRelativePath'],
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 10,
        contentHash: null,
        width: 1024,
        height: 1024,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
  };
}
