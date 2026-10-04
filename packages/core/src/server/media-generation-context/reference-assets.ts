import type { AssetFile } from '../../client/asset-files.js';
import type { CastVoice } from '../../client/cast-voices.js';
import type { MediaGenerationAssetFile, MediaGenerationCastVoice, MediaGenerationLookbookImage, MediaGenerationLookbookSheet } from '../../client/media-generation-context.js';
import type { LookbookImage, LookbookSheet } from '../../client/visual-language.js';
import { isDeepStrictEqual } from 'node:util';
import { ProjectDataError } from '../project-data-error.js';

export class GenerationAssetFiles {
  private readonly assetFiles = new Map<string, MediaGenerationAssetFile>();

  add(assetFile: AssetFile | MediaGenerationAssetFile): string {
    const projected = projectGenerationAssetFile(assetFile);
    const previous = this.assetFiles.get(assetFile.id);
    if (previous && !isDeepStrictEqual(previous, projected)) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_CONTEXT_INCONSISTENT_MEDIA',
        `Generation context contains conflicting facts for Asset ${assetFile.id}.`,
      );
    }
    if (!previous) {
      this.assetFiles.set(assetFile.id, projected);
    }
    return assetFile.id;
  }

  get(id: string): MediaGenerationAssetFile {
    const assetFile = this.assetFiles.get(id);
    if (!assetFile) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_CONTEXT_INCONSISTENT_MEDIA',
        `Generation context cannot resolve Asset ${id}.`,
      );
    }
    return assetFile;
  }

  values(): MediaGenerationAssetFile[] {
    return [...this.assetFiles.values()];
  }
}

export function projectGenerationAssetFile(assetFile: AssetFile | MediaGenerationAssetFile): MediaGenerationAssetFile {
  if (!('generationProvenance' in assetFile)) {
    return assetFile;
  }
  const { generationProvenance: _generationProvenance, ...reference } = assetFile;
  return reference;
}

export function projectGenerationVoice(voice: CastVoice, assetFiles: GenerationAssetFiles): MediaGenerationCastVoice {
  const { sample, ...facts } = voice;
  return { ...facts, sampleAssetFileId: assetFiles.add(sample) };
}

export function projectGenerationLookbookImage(image: LookbookImage, assetFiles: GenerationAssetFiles): MediaGenerationLookbookImage {
  const { assetFile, ...facts } = image;
  return { ...facts, assetFileId: assetFiles.add(assetFile) };
}

export function projectGenerationLookbookSheet(sheet: LookbookSheet, assetFiles: GenerationAssetFiles): MediaGenerationLookbookSheet {
  const { assetFile, ...facts } = sheet;
  return { ...facts, assetFileId: assetFiles.add(assetFile) };
}
