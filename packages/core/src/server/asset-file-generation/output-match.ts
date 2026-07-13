import type { GenerationRun } from '../../client/generation.js';
import type { AssetFileRecord } from '../database/access/asset-files.js';

export interface MediaGenerationOutputMatch {
  artifactId: string | null;
  contentHash: string;
  mediaKind: string;
}

export function matchingMediaGenerationOutputs(
  run: GenerationRun,
  file: AssetFileRecord,
): MediaGenerationOutputMatch[] {
  if (!file.contentHash) {
    return [];
  }
  const fileContentHash = normalizeContentHash(file.contentHash);
  return readGenerationOutputs(run.outputs).filter(
    (output) =>
      normalizeContentHash(output.contentHash) === fileContentHash &&
      output.mediaKind === file.mediaKind,
  );
}

function normalizeContentHash(contentHash: string): string {
  return contentHash.startsWith('sha256:')
    ? contentHash.slice('sha256:'.length)
    : contentHash;
}

function readGenerationOutputs(outputs: unknown): MediaGenerationOutputMatch[] {
  if (!Array.isArray(outputs)) {
    return [];
  }
  return outputs.flatMap((output) => {
    if (!output || typeof output !== 'object') {
      return [];
    }
    const candidate = output as {
      artifactId?: unknown;
      contentHash?: unknown;
      mimeType?: unknown;
      mediaKind?: unknown;
    };
    if (typeof candidate.contentHash !== 'string') {
      return [];
    }
    const mediaKind =
      typeof candidate.mediaKind === 'string'
        ? candidate.mediaKind
        : mediaKindForMimeType(candidate.mimeType);
    if (!mediaKind) {
      return [];
    }
    return [
      {
        artifactId:
          typeof candidate.artifactId === 'string'
            ? candidate.artifactId
            : null,
        contentHash: candidate.contentHash,
        mediaKind,
      },
    ];
  });
}

function mediaKindForMimeType(mimeType: unknown): string | null {
  if (typeof mimeType !== 'string') {
    return null;
  }
  const separator = mimeType.indexOf('/');
  return separator > 0 ? mimeType.slice(0, separator) : null;
}
