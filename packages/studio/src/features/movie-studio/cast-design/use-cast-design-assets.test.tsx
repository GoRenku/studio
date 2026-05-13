// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Asset, CastMember } from '@gorenku/studio-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateCastDesignResource,
  readCastDesignResource,
} from '@/services/studio-project-assets-api';
import { useCastDesignAssets } from './use-cast-design-assets';

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: (
    projectName: string,
    castMemberId: string,
    assetId: string,
    assetFileId: string
  ) => `/projects/${projectName}/cast/${castMemberId}/assets/${assetId}/files/${assetFileId}`,
  invalidateCastDesignResource: vi.fn(),
  readCastDesignResource: vi.fn(),
  selectCastAsset: vi.fn(),
  unselectCastAsset: vi.fn(),
}));

describe('useCastDesignAssets', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the cast design resource when the panel opens', async () => {
    const fetchedAsset = castAsset({
      assetId: 'asset_fetched_sheet',
      role: 'character_sheet',
      selection: { kind: 'take' },
    });
    vi.mocked(readCastDesignResource).mockResolvedValue(
      castDesignResource([fetchedAsset])
    );

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
    expect(readCastDesignResource).toHaveBeenCalledWith(
      'constantinople-fetch',
      'cast_1'
    );
  });

  it('reloads when coordination reports changed cast design resources', async () => {
    vi.mocked(readCastDesignResource)
      .mockResolvedValueOnce(
        castDesignResource([
          castAsset({
            assetId: 'asset_original_sheet',
            role: 'character_sheet',
            selection: { kind: 'take' },
          }),
        ])
      )
      .mockResolvedValueOnce(
        castDesignResource([
          castAsset({
            assetId: 'asset_refreshed_sheet',
            role: 'character_sheet',
            selection: { kind: 'take' },
          }),
        ])
      );

    const { result } = renderHook(() =>
      useCastDesignAssets({
        projectName: 'constantinople-refresh',
        castEntry: castMember,
      })
    );
    await waitFor(() => {
      expect(result.current.characterSheetContent.takes).toEqual([
        expect.objectContaining({ assetId: 'asset_original_sheet' }),
      ]);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: 'constantinople-refresh',
            resourceKeys: ['assets:castMember:cast_1'],
          },
        })
      );
    });

    await waitFor(() => {
      expect(result.current.characterSheetContent.takes).toEqual([
        expect.objectContaining({ assetId: 'asset_refreshed_sheet' }),
      ]);
    });
    expect(invalidateCastDesignResource).toHaveBeenCalledWith(
      'constantinople-refresh',
      'cast_1'
    );
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

function castDesignResource(assets: Asset[]) {
  return {
    castMember,
    selectedAssets: assets.filter((asset) => asset.selection.kind === 'select'),
    activeTakePage: {
      items: assets.filter((asset) => asset.selection.kind === 'take'),
      nextCursor: null,
    },
    countsByRole: [],
  };
}
