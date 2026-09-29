import type { Asset } from '../../client/assets.js';
import type { CastVoice } from '../../client/cast-voices.js';
import type { MediaGenerationAsset, MediaGenerationCastVoice, MediaGenerationLookbookImage, MediaGenerationLookbookSheet } from '../../client/media-generation-context.js';
import type { LookbookImage, LookbookSheet } from '../../client/visual-language.js';
import { isDeepStrictEqual } from 'node:util';
import { ProjectDataError } from '../project-data-error.js';

export class GenerationAssets {
  private readonly assets = new Map<string, MediaGenerationAsset>();

  add(asset: Asset | MediaGenerationAsset): string {
    const projected = projectGenerationAsset(asset);
    const previous = this.assets.get(asset.id);
    if (previous && !isDeepStrictEqual(previous, projected)) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_CONTEXT_INCONSISTENT_MEDIA',
        `Generation context contains conflicting facts for Asset ${asset.id}.`,
      );
    }
    if (!previous) {
      this.assets.set(asset.id, projected);
    }
    return asset.id;
  }

  get(id: string): MediaGenerationAsset {
    const asset = this.assets.get(id);
    if (!asset) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_CONTEXT_INCONSISTENT_MEDIA',
        `Generation context cannot resolve Asset ${id}.`,
      );
    }
    return asset;
  }

  values(): MediaGenerationAsset[] {
    return [...this.assets.values()];
  }
}

export function projectGenerationAsset(asset: Asset | MediaGenerationAsset): MediaGenerationAsset {
  if (!('generationProvenance' in asset)) {
    return asset;
  }
  const { generationProvenance: _generationProvenance, ...reference } = asset;
  return reference;
}

export function projectGenerationVoice(voice: CastVoice, assets: GenerationAssets): MediaGenerationCastVoice {
  const { sample, ...facts } = voice;
  return { ...facts, sampleAssetId: assets.add(sample) };
}

export function projectGenerationLookbookImage(image: LookbookImage, assets: GenerationAssets): MediaGenerationLookbookImage {
  const { asset, ...facts } = image;
  return { ...facts, assetId: assets.add(asset) };
}

export function projectGenerationLookbookSheet(sheet: LookbookSheet, assets: GenerationAssets): MediaGenerationLookbookSheet {
  const { asset, ...facts } = sheet;
  return { ...facts, assetId: assets.add(asset) };
}
