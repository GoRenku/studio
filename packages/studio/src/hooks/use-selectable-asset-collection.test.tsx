// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { useSelectableAssetCollection } from './use-selectable-asset-collection';

describe('useSelectableAssetCollection', () => {
  it('refreshes after mutations and returns unchanged resource keys', async () => {
    const asset = { id: 'asset_cover' } as StudioAssetResponse;
    const readAssets = vi.fn()
      .mockResolvedValueOnce({ items: [asset], selectedAssetId: null })
      .mockResolvedValueOnce({ items: [asset], selectedAssetId: asset.id })
      .mockResolvedValueOnce({ items: [], selectedAssetId: null });
    const selectCanonicalAsset = vi.fn().mockResolvedValue({
      resourceKeys: ['surface:project:covers', 'project-shell'],
    });
    const clearCanonicalAsset = vi.fn();
    const discardAsset = vi.fn().mockResolvedValue({
      resourceKeys: ['surface:project:covers', 'trash:list'],
    });
    const { result } = renderHook(() => useSelectableAssetCollection({
      readAssets,
      selectCanonicalAsset,
      clearCanonicalAsset,
      discardAsset,
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let selectionReport: { resourceKeys: string[] } | undefined;
    await act(async () => {
      selectionReport = await result.current.toggleCanonical(asset);
    });
    expect(selectionReport?.resourceKeys).toEqual([
      'surface:project:covers',
      'project-shell',
    ]);
    expect(result.current.collection.selectedAssetId).toBe(asset.id);

    let discardReport: { resourceKeys: string[] } | undefined;
    await act(async () => {
      discardReport = await result.current.remove(asset);
    });
    expect(discardReport?.resourceKeys).toEqual([
      'surface:project:covers',
      'trash:list',
    ]);
    expect(result.current.collection.items).toEqual([]);
    expect(readAssets).toHaveBeenCalledTimes(3);
  });
});
