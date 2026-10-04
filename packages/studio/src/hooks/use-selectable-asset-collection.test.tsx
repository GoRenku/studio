// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { useSelectableAssetFileCollection } from './use-selectable-asset-collection';

describe('useSelectableAssetFileCollection', () => {
  it('refreshes after mutations and returns unchanged resource keys', async () => {
    const assetFile = { id: 'asset_cover' } as StudioAssetFileResponse;
    const readAssetFiles = vi.fn()
      .mockResolvedValueOnce({ items: [assetFile], selectedAssetFileId: null })
      .mockResolvedValueOnce({ items: [assetFile], selectedAssetFileId: assetFile.id })
      .mockResolvedValueOnce({ items: [], selectedAssetFileId: null });
    const selectCanonicalAssetFile = vi.fn().mockResolvedValue({
      resourceKeys: ['surface:project:covers', 'project-shell'],
    });
    const clearCanonicalAssetFile = vi.fn();
    const discardAssetFile = vi.fn().mockResolvedValue({
      resourceKeys: ['surface:project:covers', 'trash:list'],
    });
    const { result } = renderHook(() => useSelectableAssetFileCollection({
      readAssetFiles,
      selectCanonicalAssetFile,
      clearCanonicalAssetFile,
      discardAssetFile,
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let selectionReport: { resourceKeys: string[] } | undefined;
    await act(async () => {
      selectionReport = await result.current.toggleCanonical(assetFile);
    });
    expect(selectionReport?.resourceKeys).toEqual([
      'surface:project:covers',
      'project-shell',
    ]);
    expect(result.current.collection.selectedAssetFileId).toBe(assetFile.id);

    let discardReport: { resourceKeys: string[] } | undefined;
    await act(async () => {
      discardReport = await result.current.remove(assetFile);
    });
    expect(discardReport?.resourceKeys).toEqual([
      'surface:project:covers',
      'trash:list',
    ]);
    expect(result.current.collection.items).toEqual([]);
    expect(readAssetFiles).toHaveBeenCalledTimes(3);
  });
});
