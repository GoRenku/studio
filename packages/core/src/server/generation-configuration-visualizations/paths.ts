import path from 'node:path';
import { resolveRenkuConfigDir } from '../config/index.js';
import type {
  GenerationConfigurationVisualizationCacheDescriptor,
  GenerationConfigurationVisualizationCacheOptions,
  GenerationConfigurationVisualizationCachePaths,
} from './contracts.js';
import { parseGenerationConfigurationVisualizationCacheDescriptor } from './descriptor.js';

const CACHE_DIRECTORY_NAME = 'generation-configuration-visualizations' as const;
const CACHE_VERSION_DIRECTORY_NAME = 'v1' as const;

export function resolveGenerationConfigurationVisualizationCacheRoot(
  options: GenerationConfigurationVisualizationCacheOptions = {}
): string {
  return path.join(
    resolveRenkuConfigDir(options),
    'cache',
    CACHE_DIRECTORY_NAME,
    CACHE_VERSION_DIRECTORY_NAME
  );
}

export function resolveGenerationConfigurationVisualizationCachePaths(
  descriptor: GenerationConfigurationVisualizationCacheDescriptor,
  options: GenerationConfigurationVisualizationCacheOptions = {}
): GenerationConfigurationVisualizationCachePaths {
  const parsed = parseGenerationConfigurationVisualizationCacheDescriptor(descriptor);
  const cacheDirectory = path.join(
    resolveGenerationConfigurationVisualizationCacheRoot(options),
    'routes',
    encodeCachePathSegment(parsed.provider),
    ...parsed.model.split('/').map(encodeCachePathSegment),
    encodeCachePathSegment(parsed.operation),
    encodeCachePathSegment(parsed.inputMode)
  );
  return {
    cacheDirectory,
    manifestPath: path.join(cacheDirectory, 'manifest.json'),
    schemaPath: path.join(cacheDirectory, 'schema.json'),
    templatePath: path.join(cacheDirectory, 'template.html'),
  };
}

function encodeCachePathSegment(value: string): string {
  return encodeURIComponent(value);
}
