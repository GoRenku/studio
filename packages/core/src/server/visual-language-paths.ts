import fs from 'node:fs/promises';
import path from 'node:path';
import {
  VISUAL_LANGUAGE_ROOT,
} from './files/asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from './files/project-relative-paths.js';
import { ProjectDataError } from './project-data-error.js';
import type { ProjectRelativePath } from '../client/index.js';

export const INSPIRATION_ROOT = joinProjectRelativePath(
  VISUAL_LANGUAGE_ROOT,
  'inspiration'
);
export const LOOKBOOK_ROOT = joinProjectRelativePath(VISUAL_LANGUAGE_ROOT, 'lookbook');

export function readablePathSegment(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

export async function allocateProjectRelativeFolderPath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  label: string;
  currentProjectRelativePath?: ProjectRelativePath;
}): Promise<ProjectRelativePath> {
  const segment = readablePathSegment(input.label);
  const currentProjectRelativePath = input.currentProjectRelativePath
    ? normalizeProjectRelativePath(input.currentProjectRelativePath)
    : null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      attempt === 0 ? segment : `${segment}-${attempt + 1}`
    );
    if (candidate === currentProjectRelativePath) {
      return candidate;
    }
    if (!(await pathExists(resolveProjectRelativePath(input.projectFolder, candidate)))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA238',
    `Could not allocate a project-relative folder for ${input.label}.`
  );
}

export async function allocateProjectRelativeFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  fileName: string;
}): Promise<ProjectRelativePath> {
  const normalizedFileName = normalizeFolderFileName(input.fileName);
  const parsed = path.parse(normalizedFileName);
  const name = parsed.name || 'untitled';
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      attempt === 0 ? normalizedFileName : `${name}-${attempt + 1}${parsed.ext}`
    );
    if (!(await pathExists(resolveProjectRelativePath(input.projectFolder, candidate)))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA247',
    `Could not allocate a project-relative file for ${input.fileName}.`
  );
}

export function assertProjectRelativeChildPath(input: {
  parent: ProjectRelativePath;
  child: ProjectRelativePath;
}): void {
  const parent = input.parent.endsWith('/') ? input.parent : `${input.parent}/`;
  if (!input.child.startsWith(parent)) {
    throw new ProjectDataError(
      'PROJECT_DATA239',
      `Path is outside the expected Visual Language folder: ${input.child}.`
    );
  }
}

export function normalizeFolderFileName(fileName: string): string {
  const normalized = normalizeProjectRelativePath(fileName);
  if (normalized.includes('/')) {
    throw new ProjectDataError(
      'PROJECT_DATA240',
      `Folder file name must not include path separators: ${fileName}.`
    );
  }
  return normalized;
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA079',
      `File must be inside the project folder: ${absolutePath}.`
    );
  }
}
