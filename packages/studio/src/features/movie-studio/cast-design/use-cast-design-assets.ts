import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Asset, CastMember } from '@gorenku/studio-core';
import {
  castAssetFileUrl,
  invalidateCastDesignResource,
  readCastDesignResource,
  selectCastAsset,
  unselectCastAsset,
} from '@/services/studio-project-assets-api';
import type { CastDesignResourceResponse } from '@/services/studio-project-contracts';
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
  assets: Asset[];
  descriptionAsset: CastDesignResourceResponse['descriptionAsset'];
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
}): CastDesignAssetsState {
  const { projectName, castEntry } = input;
  const cacheKey = castAssetsCacheKey(projectName, castEntry.id);
  const [assetState, setAssetState] = useState<CastDesignAssetsRuntimeState>(
    () => createCastDesignAssetsRuntimeState(cacheKey)
  );
  const [castAssetMutationId, setCastAssetMutationId] = useState<string | null>(
    null
  );

  let currentAssetState = assetState;
  if (currentAssetState.cacheKey !== cacheKey) {
    currentAssetState = createCastDesignAssetsRuntimeState(cacheKey);
    setAssetState(currentAssetState);
  }

  const { assets, descriptionAsset, isLoadingCastAssets, castAssetsError } =
    currentAssetState;

  const loadAssets = useCallback(async () => {
    setAssetState((current) => ({
      ...current,
      isLoadingCastAssets: true,
      castAssetsError: null,
    }));
    try {
      const resource = await readCastDesignResource(projectName, castEntry.id);
      const nextAssets = castDesignResourceAssets(resource);
      castAssetsCache.set(cacheKey, nextAssets);
      setAssetState((current) => ({
        ...current,
        assets: nextAssets,
        descriptionAsset: resource.descriptionAsset,
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
    let cancelled = false;
    void Promise.resolve()
      .then(() => readCastDesignResource(projectName, castEntry.id))
      .then((resource) => {
        const nextAssets = castDesignResourceAssets(resource);
        castAssetsCache.set(cacheKey, nextAssets);
        if (!cancelled) {
          setAssetState((current) =>
            current.cacheKey === cacheKey
              ? {
                  ...current,
                  assets: nextAssets,
                  descriptionAsset: resource.descriptionAsset,
                  isLoadingCastAssets: false,
                }
              : current
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAssetState((current) =>
            current.cacheKey === cacheKey
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
            current.cacheKey === cacheKey
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
  }, [cacheKey, castEntry.id, projectName]);

  useEffect(() => {
    const handleResourceChange = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (
        !detail ||
        detail.projectName !== projectName ||
        !detail.resourceKeys.some((resourceKey) =>
          isCastDesignResourceKey(resourceKey, castEntry.id)
        )
      ) {
        return;
      }
      invalidateCastDesignResource(projectName, castEntry.id);
      void loadAssets();
    };
    window.addEventListener(
      'renku:studio-resource-changed',
      handleResourceChange
    );
    return () => {
      window.removeEventListener(
        'renku:studio-resource-changed',
        handleResourceChange
      );
    };
  }, [castEntry.id, loadAssets, projectName]);

  const selectCastDesignAsset = useCallback(
    async (asset: CastDesignAsset) => {
      if (!asset.assetId) {
        return;
      }
      setCastAssetMutationId(asset.assetId);
      setAssetState((current) => ({ ...current, castAssetsError: null }));
      try {
        await selectCastAsset(projectName, castEntry.id, asset.assetId);
        invalidateCastDesignResource(projectName, castEntry.id);
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
        invalidateCastDesignResource(projectName, castEntry.id);
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
    () =>
      projectCastDesignAssets(
        projectName,
        castEntry,
        assets,
        descriptionAsset
      ),
    [assets, castEntry, descriptionAsset, projectName]
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

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function isCastDesignResourceKey(
  resourceKey: string,
  castMemberId: string
): boolean {
  return (
    resourceKey === `surface:cast-design:${castMemberId}` ||
    resourceKey === `assets:castMember:${castMemberId}`
  );
}

function createCastDesignAssetsRuntimeState(
  cacheKey: string
): CastDesignAssetsRuntimeState {
  const cachedAssets = castAssetsCache.get(cacheKey);
  return {
    cacheKey,
    assets: cachedAssets ?? [],
    descriptionAsset: undefined,
    isLoadingCastAssets: cachedAssets === undefined,
    castAssetsError: null,
  };
}

function castDesignResourceAssets(resource: CastDesignResourceResponse): Asset[] {
  return [
    ...resource.selectedAssets,
    ...resource.activeTakePage.items,
  ];
}

function projectCastDesignAssets(
  projectName: string,
  castEntry: CastMember,
  assets: Asset[],
  descriptionAsset: CastDesignResourceResponse['descriptionAsset']
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
      descriptionAsset,
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
