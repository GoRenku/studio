import { useCallback, useEffect, useState } from 'react';
import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import type { StudioAssetFileCollection } from '@/services/studio-project-assets-api';

interface AssetFileMutationReport {
  resourceKeys: string[];
}

export function useSelectableAssetFileCollection({
  readAssetFiles,
  selectCanonicalAssetFile,
  clearCanonicalAssetFile,
  discardAssetFile,
}: {
  readAssetFiles: () => Promise<StudioAssetFileCollection>;
  selectCanonicalAssetFile: (assetFileId: string) => Promise<AssetFileMutationReport>;
  clearCanonicalAssetFile: () => Promise<AssetFileMutationReport>;
  discardAssetFile: (assetFileId: string) => Promise<AssetFileMutationReport>;
}) {
  const [collection, setCollection] = useState<StudioAssetFileCollection>({
    items: [],
    selectedAssetFileId: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await readAssetFiles();
      setCollection(next);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [readAssetFiles]);

  useEffect(() => {
    let cancelled = false;
    void readAssetFiles()
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
  }, [readAssetFiles]);

  const toggleCanonical = useCallback(
    async (assetFile: StudioAssetFileResponse): Promise<AssetFileMutationReport> => {
      const report = collection.selectedAssetFileId === assetFile.id
        ? await clearCanonicalAssetFile()
        : await selectCanonicalAssetFile(assetFile.id);
      await refresh();
      return report;
    },
    [
      clearCanonicalAssetFile,
      collection.selectedAssetFileId,
      refresh,
      selectCanonicalAssetFile,
    ]
  );

  const remove = useCallback(
    async (assetFile: StudioAssetFileResponse): Promise<AssetFileMutationReport> => {
      const report = await discardAssetFile(assetFile.id);
      await refresh();
      return report;
    },
    [discardAssetFile, refresh]
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
