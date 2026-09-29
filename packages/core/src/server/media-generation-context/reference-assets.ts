import type { Asset } from '../../client/assets.js';
import type { CastVoice } from '../../client/cast-voices.js';
import type { MediaGenerationAsset, MediaGenerationCastVoice, MediaGenerationLookbookImage, MediaGenerationLookbookSheet } from '../../client/media-generation-context.js';
import type { LookbookImage, LookbookSheet } from '../../client/visual-language.js';

export function projectGenerationAsset(asset: Asset): MediaGenerationAsset {
  const { generationProvenance: _generationProvenance, ...reference } = asset;
  return reference;
}

export function projectGenerationVoice(voice: CastVoice): MediaGenerationCastVoice {
  return { ...voice, sample: projectGenerationAsset(voice.sample) };
}

export function projectGenerationLookbookImage(image: LookbookImage): MediaGenerationLookbookImage {
  return { ...image, asset: projectGenerationAsset(image.asset) };
}

export function projectGenerationLookbookSheet(sheet: LookbookSheet): MediaGenerationLookbookSheet {
  return { ...sheet, asset: projectGenerationAsset(sheet.asset) };
}
