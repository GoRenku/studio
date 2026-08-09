import path from 'node:path';
import { ProjectDataError } from '../../project-data-error.js';

const MAX_SEMANTIC_SEGMENT_LENGTH = 32;

export function requiredSemanticFileStem(
  value: string | undefined,
  suffix = ''
): string {
  const normalizedSuffix = normalizeSegment(suffix);
  const maximumBaseLength = MAX_SEMANTIC_SEGMENT_LENGTH -
    (normalizedSuffix ? normalizedSuffix.length + 1 : 0);
  const base = normalizeSegment(value ?? '').slice(0, maximumBaseLength)
    .replace(/-+$/u, '');
  if (!base) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SEMANTIC_NAME_REQUIRED',
      'A concise semantic name is required for this project asset file.',
      {
        suggestion:
          `Provide a meaningful name using at most ${maximumBaseLength} letters or numbers.`,
      }
    );
  }
  return normalizedSuffix ? `${base}-${normalizedSuffix}` : base;
}

export function fixedFileStem(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, MAX_SEMANTIC_SEGMENT_LENGTH)
    .replace(/-+$/u, '');
  if (!normalized) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SEMANTIC_NAME_REQUIRED',
      'A project asset file name is required.'
    );
  }
  return normalized;
}

export function sourceFileStem(sourceProjectRelativePath: string): string {
  const normalized = normalizeSegment(path.parse(sourceProjectRelativePath).name)
    .slice(0, MAX_SEMANTIC_SEGMENT_LENGTH)
    .replace(/-+$/u, '');
  return normalized || 'asset';
}

export function sceneNumberPathSegment(
  productionNumber: string,
  sceneId: string
): string {
  const number = normalizeSegment(productionNumber)
    .slice(0, MAX_SEMANTIC_SEGMENT_LENGTH)
    .replace(/-+$/u, '');
  if (number) {
    return number;
  }
  const safeSceneId = normalizeSegment(sceneId)
    .slice(0, MAX_SEMANTIC_SEGMENT_LENGTH - 6)
    .replace(/-+$/u, '');
  if (!safeSceneId) {
    return 'scene-unnumbered';
  }
  return safeSceneId.startsWith('scene-')
    ? safeSceneId
    : `scene-${safeSceneId}`;
}

function normalizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}
