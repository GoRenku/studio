import { useCallback, useEffect, useState } from 'react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import type { StudioAssetCollection } from '@/services/studio-project-assets-api';

export function useContinuityAssets({
  readAssets,
  selectCanonicalAsset,
  clearCanonicalAsset,
  discardAsset,
}: {
  readAssets: () => Promise<StudioAssetCollection>;
  selectCanonicalAsset: (assetId: string) => Promise<void>;
  clearCanonicalAsset: () => Promise<void>;
  discardAsset: (assetId: string) => Promise<string>;
}) {
  const [collection, setCollection] = useState<StudioAssetCollection>({
    items: [],
    selectedAssetId: null,
  });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await readAssets();
    setCollection(next);
    setError(null);
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
      });
    return () => {
      cancelled = true;
    };
  }, [readAssets]);

  const toggleCanonical = useCallback(
    async (asset: StudioAssetResponse) => {
      if (collection.selectedAssetId === asset.id) {
        await clearCanonicalAsset();
      } else {
        await selectCanonicalAsset(asset.id);
      }
      await refresh();
    },
    [
      clearCanonicalAsset,
      collection.selectedAssetId,
      refresh,
      selectCanonicalAsset,
    ]
  );

  const remove = useCallback(
    async (asset: StudioAssetResponse) => {
      await discardAsset(asset.id);
      await refresh();
    },
    [discardAsset, refresh]
  );

  return {
    collection,
    error,
    refresh,
    toggleCanonical,
    remove,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Continuity asset request failed.';
}
