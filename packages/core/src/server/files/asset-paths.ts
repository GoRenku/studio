import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from './project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';

export const SCREENPLAY_ROOT = joinProjectRelativePath('screenplay');
export const CAST_ROOT = joinProjectRelativePath('cast');
export const LOCATIONS_ROOT = joinProjectRelativePath('locations');
export const PROPS_ROOT = joinProjectRelativePath('props');
export const VISUAL_LANGUAGE_ROOT = joinProjectRelativePath('visual-language');
export const STORYBOARDS_ROOT = joinProjectRelativePath('storyboards');
export const SHOTS_ROOT = joinProjectRelativePath('shots');
export const PROJECT_TMP_ROOT = joinProjectRelativePath('tmp');
export const SHOTLIST_ROOT = joinProjectRelativePath('shotlist');
export const PRODUCTION_ASSETS_MASTER_ROOT = joinProjectRelativePath(
  'production-assets',
  'master'
);
export const PRODUCTION_ASSETS_LOCALIZED_ROOT = joinProjectRelativePath(
  'production-assets',
  'localized'
);

export function kebabCasePathSegment(input: string, fallback: string): string {
  const segment = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return segment || fallback;
}

export function extensionForImageOutput(format: string | null | undefined): string {
  return format === 'jpeg' ? '.jpg' : `.${format || 'png'}`;
}

export function extensionForMediaSource(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpeg') {
    return '.jpg';
  }
  return extension || '.png';
}

export async function allocateProjectRelativeFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): Promise<ProjectRelativePath> {
  const baseName = kebabCasePathSegment(input.baseName, 'asset');
  const extension = input.extension.startsWith('.')
    ? input.extension.toLowerCase()
    : `.${input.extension.toLowerCase()}`;
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0
        ? `${baseName}${extension}`
        : `${baseName}-${String(index + 1).padStart(2, '0')}${extension}`
    );
    if (!(await projectPathExists(input.projectFolder, candidate))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA442',
    `Could not allocate a unique project-relative file path for ${baseName}${extension}.`
  );
}

export async function allocateProjectRelativeVersionedFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): Promise<ProjectRelativePath> {
  const baseName = kebabCasePathSegment(input.baseName, 'asset');
  const extension = input.extension.startsWith('.')
    ? input.extension.toLowerCase()
    : `.${input.extension.toLowerCase()}`;
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `-v${String(index).padStart(2, '0')}`;
    const candidate = joinProjectRelativePath(
      input.parent,
      `${baseName}${suffix}${extension}`
    );
    if (!(await projectPathExists(input.projectFolder, candidate))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA443',
    `Could not allocate a unique versioned project-relative file path for ${baseName}${extension}.`
  );
}

export async function allocateStoryboardIterationFolder(input: {
  projectFolder: string;
  sequenceTitle: string;
  sceneTitle: string;
}): Promise<ProjectRelativePath> {
  const parent = joinProjectRelativePath(
    STORYBOARDS_ROOT,
    kebabCasePathSegment(input.sequenceTitle, 'sequence'),
    kebabCasePathSegment(input.sceneTitle, 'scene')
  );
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      parent,
      `${String(index).padStart(2, '0')}-iteration`
    );
    if (!(await projectPathExists(input.projectFolder, candidate))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA444',
    `Could not allocate a storyboard iteration folder for ${input.sceneTitle}.`
  );
}

export function storyboardTemporarySheetRoot(input: {
  sequenceTitle: string;
  sceneTitle: string;
}): ProjectRelativePath {
  return joinProjectRelativePath(
    STORYBOARDS_ROOT,
    kebabCasePathSegment(input.sequenceTitle, 'sequence'),
    kebabCasePathSegment(input.sceneTitle, 'scene'),
    'tmp'
  );
}

export function shotVideoTakeFolder(input: {
  sequenceTitle: string;
  sceneTitle: string;
  takeTitle: string;
}): ProjectRelativePath {
  return joinProjectRelativePath(
    SHOTS_ROOT,
    kebabCasePathSegment(input.sequenceTitle, 'sequence'),
    kebabCasePathSegment(input.sceneTitle, 'scene'),
    kebabCasePathSegment(input.takeTitle, 'take')
  );
}

async function projectPathExists(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<boolean> {
  try {
    await fs.access(resolveProjectRelativePath(projectFolder, projectRelativePath));
    return true;
  } catch {
    return false;
  }
}
