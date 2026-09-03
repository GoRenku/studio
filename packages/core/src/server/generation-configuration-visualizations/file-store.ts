import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveRenkuConfigDir } from '../config/index.js';
import type { GenerationConfigurationVisualizationCacheOptions } from './contracts.js';
import { generationConfigurationVisualizationCacheError } from './errors.js';

export async function assertGenerationConfigurationVisualizationCachePathIsSafe(
  cacheDirectory: string,
  options: GenerationConfigurationVisualizationCacheOptions
): Promise<void> {
  const configDirectory = resolveRenkuConfigDir(options);
  const relative = path.relative(configDirectory, cacheDirectory);
  let current = configDirectory;
  for (const segment of ['', ...relative.split(path.sep)]) {
    if (segment) {
      current = path.join(current, segment);
    }
    try {
      await assertDirectoryIsSafe(current);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }
}

export async function ensureGenerationConfigurationVisualizationCacheDirectory(
  cacheDirectory: string,
  options: GenerationConfigurationVisualizationCacheOptions
): Promise<void> {
  const configDirectory = resolveRenkuConfigDir(options);
  await fs.mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await assertDirectoryIsSafe(configDirectory);
  const relative = path.relative(configDirectory, cacheDirectory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004',
      'The generation configuration visualization cache path escaped the Renku config directory.',
      [cacheDirectory]
    );
  }
  let current = configDirectory;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      await fs.mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        throw error;
      }
    }
    await assertDirectoryIsSafe(current);
  }
}

export async function readGenerationConfigurationVisualizationCacheFile(
  filePath: string
): Promise<string | null> {
  try {
    const stats = await fs.lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw generationConfigurationVisualizationCacheError(
        'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004',
        'A generation configuration visualization cache artifact is not a regular file.',
        [filePath],
        'Move the unsafe cache entry aside and retry so Renku can rebuild it.'
      );
    }
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeGenerationConfigurationVisualizationCacheFile(
  filePath: string,
  contents: string
): Promise<void> {
  try {
    const destinationStats = await fs.lstat(filePath);
    if (!destinationStats.isFile() || destinationStats.isSymbolicLink()) {
      throw generationConfigurationVisualizationCacheError(
        'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004',
        'A generation configuration visualization cache destination is not a regular file.',
        [filePath]
      );
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let temporaryCreated = false;
  try {
    const handle = await fs.open(temporaryPath, 'wx', 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(contents, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporaryPath, filePath);
    temporaryCreated = false;
  } finally {
    if (temporaryCreated) {
      await fs.unlink(temporaryPath).catch(() => undefined);
    }
  }
}

async function assertDirectoryIsSafe(directory: string): Promise<void> {
  const stats = await fs.lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004',
      'A generation configuration visualization cache path is not a regular directory.',
      [directory],
      'Move the unsafe cache path aside and retry so Renku can rebuild it.'
    );
  }
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && 'code' in error;
}
