import type { ProjectRelativePath } from '../../client/index.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { kebabCasePathSegment } from '../files/asset-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { projectPathExists, projectPathExistsSync } from './file-operations.js';

export async function allocateProjectRelativeFolderPath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
}): Promise<ProjectRelativePath> {
  const baseName = kebabCasePathSegment(input.baseName, 'folder');
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0
        ? baseName
        : `${baseName}-${String(index + 1).padStart(2, '0')}`
    );
    if (!(await projectPathExists(input.projectFolder, candidate))) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    `Could not allocate a project asset folder for ${baseName}.`
  );
}

export function allocateProjectRelativeFolderPathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
}): ProjectRelativePath {
  const baseName = kebabCasePathSegment(input.baseName, 'folder');
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0
        ? baseName
        : `${baseName}-${String(index + 1).padStart(2, '0')}`
    );
    if (!projectPathExistsSync(input.projectFolder, candidate)) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    `Could not allocate a project asset folder for ${baseName}.`
  );
}

export async function allocateProjectRelativeFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): Promise<ProjectRelativePath> {
  const names = await allocateProjectRelativeFileNames({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export function allocateProjectRelativeFilePathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): ProjectRelativePath {
  const names = allocateProjectRelativeFileNamesSync({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export async function allocateProjectRelativeFileNames(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
}): Promise<string[]> {
  return allocateProjectRelativeNames(input, (baseName, index, extension) =>
    index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${index + 1}${extension}`
  );
}

export function allocateProjectRelativeFileNamesSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
}): string[] {
  return allocateProjectRelativeNamesSync(input, (baseName, index, extension) =>
    index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${index + 1}${extension}`
  );
}

export async function allocateProjectRelativeVersionedFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  alwaysUseVersionSuffix?: boolean;
}): Promise<ProjectRelativePath> {
  const names = await allocateProjectRelativeVersionedFileNames({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export function allocateProjectRelativeVersionedFilePathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  alwaysUseVersionSuffix?: boolean;
}): ProjectRelativePath {
  const names = allocateProjectRelativeVersionedFileNamesSync({
    ...input,
    count: 1,
  });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export async function allocateProjectRelativeVersionedFileNames(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
  alwaysUseVersionSuffix?: boolean;
}): Promise<string[]> {
  return allocateProjectRelativeNames(input, (baseName, index, extension) => {
    const version = input.alwaysUseVersionSuffix ? index + 1 : index;
    const suffix =
      version === 0 ? '' : `-v${String(version).padStart(2, '0')}`;
    return `${baseName}${suffix}${extension}`;
  });
}

export function allocateProjectRelativeVersionedFileNamesSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
  alwaysUseVersionSuffix?: boolean;
}): string[] {
  return allocateProjectRelativeNamesSync(input, (baseName, index, extension) => {
    const version = input.alwaysUseVersionSuffix ? index + 1 : index;
    const suffix =
      version === 0 ? '' : `-v${String(version).padStart(2, '0')}`;
    return `${baseName}${suffix}${extension}`;
  });
}

async function allocateProjectRelativeNames(
  input: {
    projectFolder: string;
    parent: ProjectRelativePath;
    baseName: string;
    extension: string;
    count: number;
  },
  candidateName: (baseName: string, index: number, extension: string) => string
): Promise<string[]> {
  const baseName = kebabCasePathSegment(input.baseName, 'asset');
  const extension = normalizedExtension(input.extension);
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = candidateName(baseName, index, extension);
    if (reserved.has(name)) {
      continue;
    }
    const candidate = joinProjectRelativePath(input.parent, name);
    if (await projectPathExists(input.projectFolder, candidate)) {
      continue;
    }
    reserved.add(name);
    names.push(name);
  }
  assertAllocatedNameCount(names, input.count, baseName, extension);
  return names;
}

function allocateProjectRelativeNamesSync(
  input: {
    projectFolder: string;
    parent: ProjectRelativePath;
    baseName: string;
    extension: string;
    count: number;
  },
  candidateName: (baseName: string, index: number, extension: string) => string
): string[] {
  const baseName = kebabCasePathSegment(input.baseName, 'asset');
  const extension = normalizedExtension(input.extension);
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = candidateName(baseName, index, extension);
    if (reserved.has(name)) {
      continue;
    }
    const candidate = joinProjectRelativePath(input.parent, name);
    if (projectPathExistsSync(input.projectFolder, candidate)) {
      continue;
    }
    reserved.add(name);
    names.push(name);
  }
  assertAllocatedNameCount(names, input.count, baseName, extension);
  return names;
}

function normalizedExtension(extension: string): string {
  return extension.startsWith('.')
    ? extension.toLowerCase()
    : `.${extension.toLowerCase()}`;
}

function assertAllocatedNameCount(
  names: string[],
  expectedCount: number,
  baseName: string,
  extension: string
): void {
  if (names.length !== expectedCount) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
      `Could not allocate ${expectedCount} project asset file name(s) for ${baseName}${extension}.`
    );
  }
}

export function resolveAllocatedProjectPath(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): string {
  return resolveProjectRelativePath(input.projectFolder, input.projectRelativePath);
}
