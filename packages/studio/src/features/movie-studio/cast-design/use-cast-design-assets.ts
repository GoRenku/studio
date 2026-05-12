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
  const [assets, setAssets] = useState<Asset[]>(
    () => initialAssets ?? castAssetsCache.get(cacheKey) ?? []
  );
  const [isLoadingCastAssets, setIsLoadingCastAssets] = useState(
    () => !initialAssets && !castAssetsCache.has(cacheKey)
  );
  const [castAssetsError, setCastAssetsError] = useState<string | null>(null);
  const [castAssetMutationId, setCastAssetMutationId] = useState<string | null>(
    null
  );

  const loadAssets = useCallback(async () => {
    setIsLoadingCastAssets(true);
    setCastAssetsError(null);
    try {
      const nextAssets = await readCastAssets(projectName, castEntry.id);
      castAssetsCache.set(cacheKey, nextAssets);
      setAssets(nextAssets);
    } catch (error) {
      setCastAssetsError(
        error instanceof Error ? error.message : 'Unable to load cast assets.'
      );
    } finally {
      setIsLoadingCastAssets(false);
    }
  }, [cacheKey, castEntry.id, projectName]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => readCastAssets(projectName, castEntry.id))
      .then((nextAssets) => {
        castAssetsCache.set(cacheKey, nextAssets);
        if (!cancelled) {
          setAssets(nextAssets);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCastAssetsError(
            error instanceof Error
              ? error.message
              : 'Unable to load cast assets.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCastAssets(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, castEntry.id, projectName]);

  const selectCastDesignAsset = useCallback(
    async (asset: CastDesignAsset) => {
      if (!asset.assetId) {
        return;
      }
      setCastAssetMutationId(asset.assetId);
      setCastAssetsError(null);
      try {
        await selectCastAsset(projectName, castEntry.id, asset.assetId);
        await loadAssets();
      } catch (error) {
        setCastAssetsError(
          error instanceof Error ? error.message : 'Unable to select asset.'
        );
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
      setCastAssetsError(null);
      try {
        await unselectCastAsset(projectName, castEntry.id, asset.assetId);
        await loadAssets();
      } catch (error) {
        setCastAssetsError(
          error instanceof Error ? error.message : 'Unable to unselect asset.'
        );
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
