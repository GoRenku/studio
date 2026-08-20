import { useCallback, useEffect, useState } from 'react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import type { StudioAssetCollection } from '@/services/studio-project-assets-api';

interface AssetMutationReport {
  resourceKeys: string[];
}

export function useSelectableAssetCollection({
  readAssets,
  selectCanonicalAsset,
  clearCanonicalAsset,
  discardAsset,
}: {
  readAssets: () => Promise<StudioAssetCollection>;
  selectCanonicalAsset: (assetId: string) => Promise<AssetMutationReport>;
  clearCanonicalAsset: () => Promise<AssetMutationReport>;
  discardAsset: (assetId: string) => Promise<AssetMutationReport>;
}) {
  const [collection, setCollection] = useState<StudioAssetCollection>({
    items: [],
    selectedAssetId: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await readAssets();
      setCollection(next);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [readAssets]);

  useEffect(() => {
    let cancelled = false;
    void readAssets()
      .then((next) => {
        if (!cancelled) {
          setCollection(next);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(errorMessage(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readAssets]);

  const toggleCanonical = useCallback(
    async (asset: StudioAssetResponse): Promise<AssetMutationReport> => {
      const report = collection.selectedAssetId === asset.id
        ? await clearCanonicalAsset()
        : await selectCanonicalAsset(asset.id);
      await refresh();
      return report;
    },
    [
      clearCanonicalAsset,
      collection.selectedAssetId,
      refresh,
      selectCanonicalAsset,
    ]
  );

  const remove = useCallback(
    async (asset: StudioAssetResponse): Promise<AssetMutationReport> => {
      const report = await discardAsset(asset.id);
      await refresh();
      return report;
    },
    [discardAsset, refresh]
  );

  return {
    collection,
    error,
    loading,
    refresh,
    toggleCanonical,
    remove,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Asset request failed.';
}
