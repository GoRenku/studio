import fs from 'node:fs/promises';
import path from 'node:path';
import {
  inspectGenerationConfigurationVisualizationCache,
  invalidateGenerationConfigurationVisualizationCache,
  parseGenerationConfigurationVisualizationCacheDescriptor,
  refreshGenerationConfigurationVisualizationCache,
  storeGenerationConfigurationVisualizationCache,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationCommandInput } from './command.js';

export async function inspectGenerationConfigurationVisualization(
  input: GenerationCommandInput
) {
  return inspectGenerationConfigurationVisualizationCache(
    await readDescriptor(input),
    { homeDir: input.runtime.homeDir }
  );
}

export async function storeGenerationConfigurationVisualization(
  input: GenerationCommandInput
) {
  const [descriptor, schemaDocument, template] = await Promise.all([
    readDescriptor(input),
    readInputFile(requiredScalarFlag(input.flags.schema, '--schema'), '--schema'),
    readInputFile(requiredScalarFlag(input.flags.template, '--template'), '--template'),
  ]);
  return storeGenerationConfigurationVisualizationCache({
    descriptor,
    schemaDocument,
    template,
    options: { homeDir: input.runtime.homeDir },
  });
}

export async function refreshGenerationConfigurationVisualization(
  input: GenerationCommandInput
) {
  const [descriptor, schemaDocument] = await Promise.all([
    readDescriptor(input),
    readInputFile(requiredScalarFlag(input.flags.schema, '--schema'), '--schema'),
  ]);
  return refreshGenerationConfigurationVisualizationCache({
    descriptor,
    schemaDocument,
    options: { homeDir: input.runtime.homeDir },
  });
}

export async function invalidateGenerationConfigurationVisualization(
  input: GenerationCommandInput
) {
  return invalidateGenerationConfigurationVisualizationCache(
    await readDescriptor(input),
    { homeDir: input.runtime.homeDir }
  );
}

async function readDescriptor(input: GenerationCommandInput) {
  const file = requiredScalarFlag(input.flags.file, '--file');
  let value: unknown;
  try {
    value = JSON.parse(await readInputFile(file, '--file')) as unknown;
  } catch (error) {
    if (error instanceof StructuredError) {
      throw error;
    }
    throw new StructuredError({
      code: 'CLI164',
      message: `Generation configuration visualization cache descriptor is not valid JSON: ${file}.`,
      suggestion: error instanceof Error ? error.message : undefined,
    });
  }
  return parseGenerationConfigurationVisualizationCacheDescriptor(value);
}

async function readInputFile(file: string, flag: string): Promise<string> {
  const absolutePath = path.resolve(file);
  try {
    const stats = await fs.lstat(absolutePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error('The path is not a regular file.');
    }
    return await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new StructuredError({
      code: 'CLI165',
      message: `Could not read ${flag} input file: ${file}.`,
      suggestion: error instanceof Error ? error.message : undefined,
    });
  }
}

function requiredScalarFlag(
  value: string | string[] | undefined,
  flag: string
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new StructuredError({
      code: 'CLI001',
      message: `Missing required flag: ${flag}.`,
    });
  }
  return value;
}
