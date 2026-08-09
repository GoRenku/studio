import type { ProjectRelativePath } from '../../client/index.js';
import {
  joinProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { projectPathExists, projectPathExistsSync } from './file-operations.js';
import {
  createGenerationFileToken,
  isGenerationFileToken,
  type GenerationFileTokenSource,
} from './naming/generation-tokens.js';
import {
  fixedFileStem,
  sourceFileStem,
} from './naming/safe-segments.js';
import { normalizedProjectFileExtension } from './naming/source-file-names.js';
import type { ProjectAssetFileNamingMode } from './types.js';

export async function allocateProjectRelativeFolderPath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
}): Promise<ProjectRelativePath> {
  const baseName = fixedFileStem(input.baseName);
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0 ? baseName : `${baseName}-${index + 1}`
    );
    if (!(await projectPathExists(input.projectFolder, candidate))) {
      return candidate;
    }
  }
  throw folderAllocationFailed(baseName);
}

export function allocateProjectRelativeFolderPathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
}): ProjectRelativePath {
  const baseName = fixedFileStem(input.baseName);
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      input.parent,
      index === 0 ? baseName : `${baseName}-${index + 1}`
    );
    if (!projectPathExistsSync(input.projectFolder, candidate)) {
      return candidate;
    }
  }
  throw folderAllocationFailed(baseName);
}

export async function allocateProjectRelativeFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): Promise<ProjectRelativePath> {
  const names = await allocatePlainNames({ ...input, count: 1 });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export function allocateProjectRelativeFilePathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
}): ProjectRelativePath {
  const names = allocatePlainNamesSync({ ...input, count: 1 });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export async function allocateProjectAssetFilePath(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  namingMode: ProjectAssetFileNamingMode;
  generatedBaseName: string;
  sourceProjectRelativePath: string;
  outputFormatHint?: string;
  tokenSource?: GenerationFileTokenSource;
}): Promise<ProjectRelativePath> {
  const names = await allocateProjectAssetFileNames({ ...input, count: 1 });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export function allocateProjectAssetFilePathSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  namingMode: ProjectAssetFileNamingMode;
  generatedBaseName: string;
  sourceProjectRelativePath: string;
  outputFormatHint?: string;
  tokenSource?: GenerationFileTokenSource;
}): ProjectRelativePath {
  const names = allocateProjectAssetFileNamesSync({ ...input, count: 1 });
  return joinProjectRelativePath(input.parent, names[0]!);
}

export async function allocateProjectAssetFileNames(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  namingMode: ProjectAssetFileNamingMode;
  generatedBaseName: string;
  sourceProjectRelativePath: string;
  outputFormatHint?: string;
  count: number;
  tokenSource?: GenerationFileTokenSource;
}): Promise<string[]> {
  return input.namingMode.kind === 'generated'
    ? allocateGeneratedNames(input, async (name) =>
        projectPathExists(input.projectFolder, joinProjectRelativePath(input.parent, name))
      )
    : allocateExternalNames(input, async (name) =>
        projectPathExists(input.projectFolder, joinProjectRelativePath(input.parent, name))
      );
}

export function allocateProjectAssetFileNamesSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  namingMode: ProjectAssetFileNamingMode;
  generatedBaseName: string;
  sourceProjectRelativePath: string;
  outputFormatHint?: string;
  count: number;
  tokenSource?: GenerationFileTokenSource;
}): string[] {
  return input.namingMode.kind === 'generated'
    ? allocateGeneratedNamesSync(input, (name) =>
        projectPathExistsSync(input.projectFolder, joinProjectRelativePath(input.parent, name))
      )
    : allocateExternalNamesSync(input, (name) =>
        projectPathExistsSync(input.projectFolder, joinProjectRelativePath(input.parent, name))
      );
}

async function allocateGeneratedNames(
  input: {
    generatedBaseName: string;
    sourceProjectRelativePath: string;
    outputFormatHint?: string;
    count: number;
    tokenSource?: GenerationFileTokenSource;
  },
  exists: (name: string) => Promise<boolean>
): Promise<string[]> {
  const baseName = fixedFileStem(input.generatedBaseName);
  const extension = normalizedProjectFileExtension(
    input.sourceProjectRelativePath,
    input.outputFormatHint
  );
  const tokenSource = input.tokenSource ?? createGenerationFileToken;
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let output = 0; output < input.count; output += 1) {
    let allocated: string | null = null;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const token = tokenSource();
      if (!isGenerationFileToken(token)) {
        throw new ProjectDataError(
          'PROJECT_ASSET_FILE_GENERATION_TOKEN_INVALID',
          'Generated project asset file token source returned an invalid token.'
        );
      }
      const name = `${baseName}-g${token}${extension}`;
      if (!reserved.has(name) && !(await exists(name))) {
        allocated = name;
        break;
      }
    }
    if (!allocated) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_GENERATION_TOKEN_ALLOCATION_FAILED',
        `Could not allocate a generated project asset file name for ${baseName}${extension}.`
      );
    }
    reserved.add(allocated);
    names.push(allocated);
  }
  return names;
}

function allocateGeneratedNamesSync(
  input: {
    generatedBaseName: string;
    sourceProjectRelativePath: string;
    outputFormatHint?: string;
    count: number;
    tokenSource?: GenerationFileTokenSource;
  },
  exists: (name: string) => boolean
): string[] {
  const baseName = fixedFileStem(input.generatedBaseName);
  const extension = normalizedProjectFileExtension(
    input.sourceProjectRelativePath,
    input.outputFormatHint
  );
  const tokenSource = input.tokenSource ?? createGenerationFileToken;
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let output = 0; output < input.count; output += 1) {
    let allocated: string | null = null;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const token = tokenSource();
      if (!isGenerationFileToken(token)) {
        throw new ProjectDataError(
          'PROJECT_ASSET_FILE_GENERATION_TOKEN_INVALID',
          'Generated project asset file token source returned an invalid token.'
        );
      }
      const name = `${baseName}-g${token}${extension}`;
      if (!reserved.has(name) && !exists(name)) {
        allocated = name;
        break;
      }
    }
    if (!allocated) {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_GENERATION_TOKEN_ALLOCATION_FAILED',
        `Could not allocate a generated project asset file name for ${baseName}${extension}.`
      );
    }
    reserved.add(allocated);
    names.push(allocated);
  }
  return names;
}

async function allocateExternalNames(
  input: {
    sourceProjectRelativePath: string;
    outputFormatHint?: string;
    count: number;
  },
  exists: (name: string) => Promise<boolean>
): Promise<string[]> {
  const baseName = sourceFileStem(input.sourceProjectRelativePath);
  const extension = normalizedProjectFileExtension(
    input.sourceProjectRelativePath,
    input.outputFormatHint
  );
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${index + 1}${extension}`;
    if (!reserved.has(name) && !(await exists(name))) {
      reserved.add(name);
      names.push(name);
    }
  }
  assertExternalNameCount(names, input.count, baseName, extension);
  return names;
}

function allocateExternalNamesSync(
  input: {
    sourceProjectRelativePath: string;
    outputFormatHint?: string;
    count: number;
  },
  exists: (name: string) => boolean
): string[] {
  const baseName = sourceFileStem(input.sourceProjectRelativePath);
  const extension = normalizedProjectFileExtension(
    input.sourceProjectRelativePath,
    input.outputFormatHint
  );
  const names: string[] = [];
  const reserved = new Set<string>();
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${index + 1}${extension}`;
    if (!reserved.has(name) && !exists(name)) {
      reserved.add(name);
      names.push(name);
    }
  }
  assertExternalNameCount(names, input.count, baseName, extension);
  return names;
}

async function allocatePlainNames(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
}): Promise<string[]> {
  const baseName = fixedFileStem(input.baseName);
  const extension = normalizedProjectFileExtension(
    `asset${input.extension}`
  );
  return allocateSequentialNames(input.count, async (index) => {
    const name = index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${index + 1}${extension}`;
    return await projectPathExists(
      input.projectFolder,
      joinProjectRelativePath(input.parent, name)
    ) ? null : name;
  });
}

function allocatePlainNamesSync(input: {
  projectFolder: string;
  parent: ProjectRelativePath;
  baseName: string;
  extension: string;
  count: number;
}): string[] {
  const baseName = fixedFileStem(input.baseName);
  const extension = normalizedProjectFileExtension(
    `asset${input.extension}`
  );
  const names: string[] = [];
  for (let index = 0; names.length < input.count && index < 1000; index += 1) {
    const name = index === 0
      ? `${baseName}${extension}`
      : `${baseName}-${index + 1}${extension}`;
    if (!projectPathExistsSync(
      input.projectFolder,
      joinProjectRelativePath(input.parent, name)
    )) {
      names.push(name);
    }
  }
  assertExternalNameCount(names, input.count, baseName, extension);
  return names;
}

async function allocateSequentialNames(
  count: number,
  candidate: (index: number) => Promise<string | null>
): Promise<string[]> {
  const names: string[] = [];
  for (let index = 0; names.length < count && index < 1000; index += 1) {
    const name = await candidate(index);
    if (name) {
      names.push(name);
    }
  }
  if (names.length !== count) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
      'Could not allocate the requested project file names.'
    );
  }
  return names;
}

function assertExternalNameCount(
  names: string[],
  expectedCount: number,
  baseName: string,
  extension: string
): void {
  if (names.length !== expectedCount) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_EXTERNAL_NAME_ALLOCATION_FAILED',
      `Could not allocate ${expectedCount} external project asset file name(s) for ${baseName}${extension}.`
    );
  }
}

function folderAllocationFailed(baseName: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    `Could not allocate a project asset folder for ${baseName}.`
  );
}

export function resolveAllocatedProjectPath(input: {
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): string {
  return resolveProjectRelativePath(input.projectFolder, input.projectRelativePath);
}
