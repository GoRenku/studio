import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  GenerationConfigurationVisualizationCacheDescriptor,
  GenerationConfigurationVisualizationCacheOptions,
} from './contracts.js';
import { inspectGenerationConfigurationVisualizationCache } from './service.js';
import { listMediaModels } from '../media-model-library/service.js';
import { parseGenerationConfigurationVisualizationCacheDescriptor } from './descriptor.js';
import { hashGenerationConfigurationTemplate } from './documents.js';
import { materializeGenerationConfigurationVisualization } from './materialization.js';
import { resolveGenerationConfigurationVisualizationCacheRoot } from './paths.js';
import {
  readGenerationConfigurationVisualizationCacheFile,
  writeGenerationConfigurationVisualizationCacheFile,
} from './file-store.js';
import {
  GenerationConfigurationVisualizationCacheError,
  generationConfigurationVisualizationCacheError,
} from './errors.js';

export async function prepareGenerationConfigurationVisualization(input: {
  descriptor: Omit<GenerationConfigurationVisualizationCacheDescriptor, 'routeCatalogSha256'>;
  bundledRouteIndexPaths: readonly string[];
  payload: unknown;
  outputPath: string;
  options?: GenerationConfigurationVisualizationCacheOptions;
}) {
  const catalog = await listMediaModels({ ...input.options, bundledRouteIndexPaths: input.bundledRouteIndexPaths });
  const descriptor = parseGenerationConfigurationVisualizationCacheDescriptor({
    ...input.descriptor, routeCatalogSha256: catalog.routeCatalogSha256,
  });
  const inspection = await inspectGenerationConfigurationVisualizationCache(descriptor, input.options);
  if (inspection.status !== 'fresh') {
    return { ...inspection, descriptor, routes: catalog.routes };
  }
  try {
    const template = await readGenerationConfigurationVisualizationCacheFile(inspection.templatePath);
    if (template === null || hashGenerationConfigurationTemplate(template) !== inspection.manifest.templateSha256) {
      return { ...inspection, descriptor, routes: catalog.routes, status: 'invalid' as const, reason: 'The cached template changed during preparation.' };
    }
    const html = materializeGenerationConfigurationVisualization(template, input.payload);
    const outputPath = path.resolve(input.outputPath);
    await assertInstanceDestination(outputPath, input.options);
    await writeGenerationConfigurationVisualizationCacheFile(outputPath, html);
    return {
      ...inspection,
      descriptor,
      outputPath,
      byteLength: Buffer.byteLength(html, 'utf8'),
      sha256: hashGenerationConfigurationTemplate(html),
    };
  } catch (error) {
    if (error instanceof GenerationConfigurationVisualizationCacheError) {
      throw error;
    }
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE005',
      'Could not prepare the generation configuration visualization.', [input.outputPath],
      error instanceof Error ? error.message : undefined,
    );
  }
}

async function assertInstanceDestination(
  outputPath: string,
  options: GenerationConfigurationVisualizationCacheOptions = {},
): Promise<void> {
  const root = resolveGenerationConfigurationVisualizationCacheRoot(options);
  assertOutsideCache(root, outputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const [realRoot, realDirectory] = await Promise.all([
    fs.realpath(root), fs.realpath(path.dirname(outputPath)),
  ]);
  assertOutsideCache(realRoot, path.join(realDirectory, path.basename(outputPath)));
}

function assertOutsideCache(root: string, outputPath: string): void {
  const relative = path.relative(root, outputPath);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004',
      'Request-specific visualization output must be outside the shared cache.', [outputPath],
    );
  }
}
