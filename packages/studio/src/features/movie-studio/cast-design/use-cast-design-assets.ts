import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Asset, CastMember } from '@gorenku/studio-core';
import {
  castAssetFileUrl,
  readCastAssets,
  selectCastAsset,
  unselectCastAsset,
} from '@/services/studio-project-assets-api';
import type {
  CastAssetCollection,
  CastDescriptionContent,
  CastDesignAsset,
  CastDesignAssetAspect,
  CastDesignAssetKind,
} from './cast-design-types';

const castAssetsCache = new Map<string, Asset[]>();

interface CastDesignAssetsRuntimeState {
  cacheKey: string;
  initialAssetsVersion: string | null;
  assets: Asset[];
  isLoadingCastAssets: boolean;
  castAssetsError: string | null;
}

export interface CastDesignAssetsState {
  descriptionContent: CastDescriptionContent;
  characterSheetContent: CastAssetCollection;
  voiceDesignContent: CastAssetCollection;
  isLoadingCastAssets: boolean;
  castAssetsError: string | null;
  castAssetMutationId: string | null;
  selectCastDesignAsset: (asset: CastDesignAsset) => Promise<void>;
  unselectCastDesignAsset: (asset: CastDesignAsset) => Promise<void>;
}

export function useCastDesignAssets(input: {
  projectName: string;
  castEntry: CastMember;
  initialAssets?: Asset[];
}): CastDesignAssetsState {
  const { projectName, castEntry, initialAssets } = input;
  const cacheKey = castAssetsCacheKey(projectName, castEntry.id);
  const initialAssetsVersion = castAssetsVersion(initialAssets);
  const [assetState, setAssetState] = useState<CastDesignAssetsRuntimeState>(
    () =>
      createCastDesignAssetsRuntimeState(
        cacheKey,
        initialAssets,
        initialAssetsVersion
      )
  );
  const [castAssetMutationId, setCastAssetMutationId] = useState<string | null>(
    null
  );

  let currentAssetState = assetState;
  if (
    currentAssetState.cacheKey !== cacheKey ||
    currentAssetState.initialAssetsVersion !== initialAssetsVersion
  ) {
    currentAssetState = createCastDesignAssetsRuntimeState(
      cacheKey,
      initialAssets,
      initialAssetsVersion
    );
    setAssetState(currentAssetState);
  }

  const { assets, isLoadingCastAssets, castAssetsError } = currentAssetState;

  const loadAssets = useCallback(async () => {
    setAssetState((current) => ({
      ...current,
      isLoadingCastAssets: true,
      castAssetsError: null,
    }));
    try {
      const nextAssets = await readCastAssets(projectName, castEntry.id);
      castAssetsCache.set(cacheKey, nextAssets);
      setAssetState((current) => ({
        ...current,
        assets: nextAssets,
        isLoadingCastAssets: false,
      }));
    } catch (error) {
      setAssetState((current) => ({
        ...current,
        isLoadingCastAssets: false,
        castAssetsError:
          error instanceof Error ? error.message : 'Unable to load cast assets.',
      }));
    }
  }, [cacheKey, castEntry.id, projectName]);

  useEffect(() => {
    if (initialAssets !== undefined) {
      castAssetsCache.set(cacheKey, initialAssets);
      return;
    }

    let cancelled = false;
    void Promise.resolve()
      .then(() => readCastAssets(projectName, castEntry.id))
      .then((nextAssets) => {
        castAssetsCache.set(cacheKey, nextAssets);
        if (!cancelled) {
          setAssetState((current) =>
            current.cacheKey === cacheKey &&
            current.initialAssetsVersion === null
              ? {
                  ...current,
                  assets: nextAssets,
                  isLoadingCastAssets: false,
                }
              : current
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAssetState((current) =>
            current.cacheKey === cacheKey &&
            current.initialAssetsVersion === null
              ? {
                  ...current,
                  isLoadingCastAssets: false,
                  castAssetsError:
                    error instanceof Error
                      ? error.message
                      : 'Unable to load cast assets.',
                }
              : current
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssetState((current) =>
            current.cacheKey === cacheKey &&
            current.initialAssetsVersion === null
              ? {
                  ...current,
                  isLoadingCastAssets: false,
                }
              : current
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, castEntry.id, initialAssets, initialAssetsVersion, projectName]);

  const selectCastDesignAsset = useCallback(
    async (asset: CastDesignAsset) => {
      if (!asset.assetId) {
        return;
      }
      setCastAssetMutationId(asset.assetId);
      setAssetState((current) => ({ ...current, castAssetsError: null }));
      try {
        await selectCastAsset(projectName, castEntry.id, asset.assetId);
        await loadAssets();
      } catch (error) {
        setAssetState((current) => ({
          ...current,
          castAssetsError:
            error instanceof Error ? error.message : 'Unable to select asset.',
        }));
      } finally {
        setCastAssetMutationId(null);
      }
    },
    [castEntry.id, loadAssets, projectName]
  );

  const unselectCastDesignAsset = useCallback(
    async (asset: CastDesignAsset) => {
      if (!asset.assetId) {
        return;
      }
      setCastAssetMutationId(asset.assetId);
      setAssetState((current) => ({ ...current, castAssetsError: null }));
      try {
        await unselectCastAsset(projectName, castEntry.id, asset.assetId);
        await loadAssets();
      } catch (error) {
        setAssetState((current) => ({
          ...current,
          castAssetsError:
            error instanceof Error ? error.message : 'Unable to unselect asset.',
        }));
      } finally {
        setCastAssetMutationId(null);
      }
    },
    [castEntry.id, loadAssets, projectName]
  );

  const projected = useMemo(
    () => projectCastDesignAssets(projectName, castEntry, assets),
    [assets, castEntry, projectName]
  );

  return {
    ...projected,
    isLoadingCastAssets,
    castAssetsError,
    castAssetMutationId,
    selectCastDesignAsset,
    unselectCastDesignAsset,
  };
}

function castAssetsCacheKey(projectName: string, castMemberId: string): string {
  return `${projectName}\n${castMemberId}`;
}

function createCastDesignAssetsRuntimeState(
  cacheKey: string,
  initialAssets: Asset[] | undefined,
  initialAssetsVersion: string | null
): CastDesignAssetsRuntimeState {
  if (initialAssets !== undefined) {
    return {
      cacheKey,
      initialAssetsVersion,
      assets: initialAssets,
      isLoadingCastAssets: false,
      castAssetsError: null,
    };
  }

  const cachedAssets = castAssetsCache.get(cacheKey);
  return {
    cacheKey,
    initialAssetsVersion,
    assets: cachedAssets ?? [],
    isLoadingCastAssets: cachedAssets === undefined,
    castAssetsError: null,
  };
}

function castAssetsVersion(assets: Asset[] | undefined): string | null {
  if (assets === undefined) {
    return null;
  }

  return assets
    .map((asset) =>
      [
        asset.assetId,
        asset.relationshipId,
        asset.role,
        asset.sortOrder,
        asset.selection.kind,
        asset.selection.kind === 'select' ? asset.selection.order : '',
        asset.updatedAt,
      ].join(':')
    )
    .join('\n');
}

function projectCastDesignAssets(
  projectName: string,
  castEntry: CastMember,
  assets: Asset[]
): Pick<
  CastDesignAssetsState,
  'descriptionContent' | 'characterSheetContent' | 'voiceDesignContent'
> {
  const designAssets = assets.map((asset) =>
    toCastDesignAsset(projectName, castEntry.id, asset)
  );
  return {
    descriptionContent: {
      descriptionText: castEntry.shortDescription ?? '',
      descriptionImages: designAssets.filter(
        (asset) => asset.kind === 'image' && isDescriptionAsset(asset)
      ),
    },
    characterSheetContent: {
      selectedAssets: selectedAssetsForRole(designAssets, 'character_sheet'),
      takes: takeAssetsForRole(designAssets, 'character_sheet'),
      emptySelected: 'No character sheets selected.',
      emptyTakes: 'Generated character sheet takes will appear here.',
    },
    voiceDesignContent: {
      selectedAssets: selectedVoiceAssets(designAssets),
      takes: takeVoiceAssets(designAssets),
      emptySelected:
        'No voice selected. Add this only if the character speaks or needs narration continuity.',
      emptyTakes: 'Generated voice takes will appear here.',
    },
  };
}

function toCastDesignAsset(
  projectName: string,
  castMemberId: string,
  asset: Asset
): CastDesignAsset {
  const primaryFile = asset.files.find((file) => file.role === 'primary') ?? asset.files[0];
  return {
    id: asset.assetId,
    assetId: asset.assetId,
    role: asset.role,
    title: asset.title,
    model: asset.origin,
    kind: castDesignAssetKind(asset),
    aspect: castDesignAssetAspect(asset, primaryFile),
    imageUrl:
      primaryFile?.mediaKind === 'image'
        ? castAssetFileUrl(projectName, castMemberId, asset.assetId, primaryFile.id)
        : undefined,
    selected: asset.selection.kind === 'select',
  };
}

function castDesignAssetKind(asset: Asset): CastDesignAssetKind {
  if (asset.mediaKind === 'image' && asset.role === 'character_sheet') {
    return 'sheet';
  }
  if (asset.mediaKind === 'image') {
    return 'image';
  }
  if (asset.mediaKind === 'audio') {
    return 'voice';
  }
  if (asset.mediaKind === 'text' || asset.mediaKind === 'markdown') {
    return 'text';
  }
  return 'image';
}

function castDesignAssetAspect(
  asset: Asset,
  file: Asset['files'][number] | undefined
): CastDesignAssetAspect {
  if (asset.mediaKind === 'audio') {
    return 'voice';
  }
  if (asset.mediaKind === 'text' || asset.mediaKind === 'markdown') {
    return 'text';
  }
  if (!file?.width || !file.height) {
    return asset.role === 'character_sheet' ? 'sheet' : 'ratio-4-3';
  }
  const ratio = file.width / file.height;
  if (ratio > 1.8) {
    return 'wide';
  }
  if (ratio > 1.4) {
    return 'sheet';
  }
  if (ratio > 1.15) {
    return 'ratio-4-3';
  }
  if (ratio < 0.7) {
    return 'ratio-9-16';
  }
  if (ratio < 0.9) {
    return 'portrait';
  }
  return 'square';
}

function isDescriptionAsset(asset: CastDesignAsset): boolean {
  return asset.role !== 'character_sheet';
}

function selectedAssetsForRole(
  assets: CastDesignAsset[],
  role: string
): CastDesignAsset[] {
  return assets.filter((asset) => asset.selected && asset.role === role);
}

function takeAssetsForRole(
  assets: CastDesignAsset[],
  role: string
): CastDesignAsset[] {
  return assets.filter((asset) => !asset.selected && asset.role === role);
}

function selectedVoiceAssets(assets: CastDesignAsset[]): CastDesignAsset[] {
  return assets.filter((asset) => asset.selected && asset.kind === 'voice');
}

function takeVoiceAssets(assets: CastDesignAsset[]): CastDesignAsset[] {
  return assets.filter((asset) => !asset.selected && asset.kind === 'voice');
}
