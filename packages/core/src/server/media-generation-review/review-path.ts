import path from 'node:path';
import type { ProjectRelativePath } from '../../client/project/index.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';

const REVIEW_ROOT = 'tmp/operations/media-generation/';

export function normalizeReviewDocumentPath(value: string): ProjectRelativePath {
  let normalized: ProjectRelativePath;
  try {
    normalized = normalizeProjectRelativePath(value);
  } catch (error) {
    throw invalidPath(value, error);
  }
  if (!normalized.startsWith(REVIEW_ROOT) || path.posix.extname(normalized) !== '.json') {
    throw invalidPath(value);
  }
  return normalized;
}

export function resolveReviewDocumentPath(
  projectFolder: string,
  documentPath: ProjectRelativePath,
): string {
  const absolutePath = resolveProjectRelativePath(projectFolder, documentPath);
  const relative = path.relative(path.resolve(projectFolder), absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw invalidPath(documentPath);
  }
  return absolutePath;
}

function invalidPath(value: string, cause?: unknown): ProjectDataError {
  return new ProjectDataError(
    'CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID',
    `Review document must be a JSON file under ${REVIEW_ROOT} Received: ${value}.`,
    { suggestion: cause instanceof Error ? cause.message : undefined },
  );
}
