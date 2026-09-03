import {
  GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION,
  GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS,
  type GenerationConfigurationVisualizationCacheDescriptor,
  type GenerationConfigurationVisualizationCacheInspection,
  type GenerationConfigurationVisualizationCacheManifest,
  type GenerationConfigurationVisualizationCacheOptions,
  type GenerationConfigurationVisualizationCachePaths,
} from './contracts.js';
import { parseGenerationConfigurationVisualizationCacheDescriptor } from './descriptor.js';
import {
  hashGenerationConfigurationSchema,
  hashGenerationConfigurationTemplate,
  parseGenerationConfigurationSchemaDocument,
  parseGenerationConfigurationVisualizationCacheManifest,
  validateGenerationConfigurationVisualizationTemplate,
} from './documents.js';
import {
  GenerationConfigurationVisualizationCacheError,
  generationConfigurationVisualizationCacheError,
} from './errors.js';
import {
  resolveGenerationConfigurationVisualizationCachePaths,
} from './paths.js';
import {
  assertGenerationConfigurationVisualizationCachePathIsSafe,
  ensureGenerationConfigurationVisualizationCacheDirectory,
  readGenerationConfigurationVisualizationCacheFile,
  writeGenerationConfigurationVisualizationCacheFile,
} from './file-store.js';

export async function inspectGenerationConfigurationVisualizationCache(
  descriptor: GenerationConfigurationVisualizationCacheDescriptor,
  options: GenerationConfigurationVisualizationCacheOptions = {}
): Promise<GenerationConfigurationVisualizationCacheInspection> {
  const parsedDescriptor = parseGenerationConfigurationVisualizationCacheDescriptor(descriptor);
  const paths = resolveGenerationConfigurationVisualizationCachePaths(parsedDescriptor, options);
  try {
    await assertGenerationConfigurationVisualizationCachePathIsSafe(paths.cacheDirectory, options);
    const manifestContents = await readGenerationConfigurationVisualizationCacheFile(paths.manifestPath);
    if (manifestContents === null) {
      return { status: 'miss', ...paths };
    }
    const manifest = parseGenerationConfigurationVisualizationCacheManifest(manifestContents);
    if (!manifest || !sameRoute(manifest, parsedDescriptor)) {
      return { status: 'invalid', reason: 'The cache manifest is invalid.', ...paths };
    }
    if (!sameTemplateDependencies(manifest, parsedDescriptor)) {
      return {
        status: 'incompatible',
        reason: 'The route catalog, Visualize Skill, or template contract changed.',
        ...paths,
      };
    }
    const [schemaDocument, template] = await Promise.all([
      readGenerationConfigurationVisualizationCacheFile(paths.schemaPath),
      readGenerationConfigurationVisualizationCacheFile(paths.templatePath),
    ]);
    if (schemaDocument === null || template === null) {
      return { status: 'invalid', reason: 'A cache artifact is missing.', ...paths };
    }
    let inputSchemaSha256: string;
    try {
      const schema = parseGenerationConfigurationSchemaDocument(schemaDocument);
      validateGenerationConfigurationVisualizationTemplate(template);
      inputSchemaSha256 = hashGenerationConfigurationSchema(schema);
    } catch (error) {
      if (
        error instanceof GenerationConfigurationVisualizationCacheError
        && (
          error.code === 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002'
          || error.code === 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE003'
        )
      ) {
        return { status: 'invalid', reason: error.message, ...paths };
      }
      throw error;
    }
    if (
      inputSchemaSha256 !== manifest.inputSchemaSha256
      || hashGenerationConfigurationTemplate(template) !== manifest.templateSha256
    ) {
      return { status: 'invalid', reason: 'A cache artifact does not match its manifest.', ...paths };
    }
    const now = currentDate(options);
    return {
      status: now.getTime() < Date.parse(manifest.expiresAt) ? 'fresh' : 'expired',
      manifest,
      ...paths,
    };
  } catch (error) {
    throw cacheIoError(error, 'inspect', paths.cacheDirectory);
  }
}

export async function storeGenerationConfigurationVisualizationCache(input: {
  descriptor: GenerationConfigurationVisualizationCacheDescriptor;
  schemaDocument: string;
  template: string;
  options?: GenerationConfigurationVisualizationCacheOptions;
}): Promise<GenerationConfigurationVisualizationCacheInspection> {
  const descriptor = parseGenerationConfigurationVisualizationCacheDescriptor(input.descriptor);
  const schema = parseGenerationConfigurationSchemaDocument(input.schemaDocument);
  validateGenerationConfigurationVisualizationTemplate(input.template);
  const options = input.options ?? {};
  const paths = resolveGenerationConfigurationVisualizationCachePaths(descriptor, options);
  const checkedAt = currentDate(options);
  const manifest: GenerationConfigurationVisualizationCacheManifest = {
    formatVersion: GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION,
    ...descriptor,
    checkedAt: checkedAt.toISOString(),
    expiresAt: new Date(
      checkedAt.getTime() + GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS
    ).toISOString(),
    inputSchemaSha256: hashGenerationConfigurationSchema(schema),
    templateSha256: hashGenerationConfigurationTemplate(input.template),
  };
  try {
    await ensureGenerationConfigurationVisualizationCacheDirectory(paths.cacheDirectory, options);
    await writeGenerationConfigurationVisualizationCacheFile(
      paths.schemaPath,
      `${JSON.stringify(schema, null, 2)}\n`
    );
    await writeGenerationConfigurationVisualizationCacheFile(paths.templatePath, input.template);
    await writeGenerationConfigurationVisualizationCacheFile(
      paths.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    return { status: 'fresh', manifest, ...paths };
  } catch (error) {
    throw cacheIoError(error, 'store', paths.cacheDirectory);
  }
}

export async function refreshGenerationConfigurationVisualizationCache(input: {
  descriptor: GenerationConfigurationVisualizationCacheDescriptor;
  schemaDocument: string;
  options?: GenerationConfigurationVisualizationCacheOptions;
}): Promise<
  | GenerationConfigurationVisualizationCacheInspection
  | (GenerationConfigurationVisualizationCachePaths & {
      status: 'refreshed';
      manifest: GenerationConfigurationVisualizationCacheManifest;
    })
  | (GenerationConfigurationVisualizationCachePaths & {
      status: 'schema-changed';
      cachedInputSchemaSha256: string;
      currentInputSchemaSha256: string;
    })
> {
  const descriptor = parseGenerationConfigurationVisualizationCacheDescriptor(input.descriptor);
  const schema = parseGenerationConfigurationSchemaDocument(input.schemaDocument);
  const options = input.options ?? {};
  const inspection = await inspectGenerationConfigurationVisualizationCache(descriptor, options);
  if (inspection.status !== 'expired') {
    return inspection;
  }
  const currentInputSchemaSha256 = hashGenerationConfigurationSchema(schema);
  if (currentInputSchemaSha256 !== inspection.manifest.inputSchemaSha256) {
    return {
      status: 'schema-changed',
      cachedInputSchemaSha256: inspection.manifest.inputSchemaSha256,
      currentInputSchemaSha256,
      cacheDirectory: inspection.cacheDirectory,
      manifestPath: inspection.manifestPath,
      schemaPath: inspection.schemaPath,
      templatePath: inspection.templatePath,
    };
  }
  const checkedAt = currentDate(options);
  const manifest: GenerationConfigurationVisualizationCacheManifest = {
    ...inspection.manifest,
    checkedAt: checkedAt.toISOString(),
    expiresAt: new Date(
      checkedAt.getTime() + GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS
    ).toISOString(),
  };
  try {
    await writeGenerationConfigurationVisualizationCacheFile(
      inspection.schemaPath,
      `${JSON.stringify(schema, null, 2)}\n`
    );
    await writeGenerationConfigurationVisualizationCacheFile(
      inspection.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    return { ...inspection, status: 'refreshed', manifest };
  } catch (error) {
    throw cacheIoError(error, 'refresh', inspection.cacheDirectory);
  }
}

export async function invalidateGenerationConfigurationVisualizationCache(
  descriptor: GenerationConfigurationVisualizationCacheDescriptor,
  options: GenerationConfigurationVisualizationCacheOptions = {}
): Promise<GenerationConfigurationVisualizationCacheInspection | (
  GenerationConfigurationVisualizationCachePaths & {
    status: 'invalidated';
    manifest: GenerationConfigurationVisualizationCacheManifest;
  }
)> {
  const inspection = await inspectGenerationConfigurationVisualizationCache(descriptor, options);
  if (inspection.status !== 'fresh' && inspection.status !== 'expired') {
    return inspection;
  }
  const manifest: GenerationConfigurationVisualizationCacheManifest = {
    ...inspection.manifest,
    expiresAt: new Date(0).toISOString(),
  };
  try {
    await writeGenerationConfigurationVisualizationCacheFile(
      inspection.manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    return { ...inspection, status: 'invalidated', manifest };
  } catch (error) {
    throw cacheIoError(error, 'invalidate', inspection.cacheDirectory);
  }
}

function sameRoute(
  manifest: GenerationConfigurationVisualizationCacheManifest,
  descriptor: GenerationConfigurationVisualizationCacheDescriptor
): boolean {
  return manifest.provider === descriptor.provider
    && manifest.model === descriptor.model
    && manifest.operation === descriptor.operation
    && manifest.inputMode === descriptor.inputMode;
}

function sameTemplateDependencies(
  manifest: GenerationConfigurationVisualizationCacheManifest,
  descriptor: GenerationConfigurationVisualizationCacheDescriptor
): boolean {
  return manifest.routeCatalogSha256 === descriptor.routeCatalogSha256
    && manifest.visualizeSkillVersion === descriptor.visualizeSkillVersion
    && manifest.visualizeSkillSha256 === descriptor.visualizeSkillSha256
    && manifest.templateContractVersion === descriptor.templateContractVersion
    && manifest.templateContractSha256 === descriptor.templateContractSha256;
}

function currentDate(options: GenerationConfigurationVisualizationCacheOptions): Date {
  const value = options.now?.() ?? new Date();
  if (!Number.isFinite(value.getTime())) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE005',
      'Generation configuration visualization cache clock returned an invalid date.',
      ['checkedAt']
    );
  }
  return value;
}

function cacheIoError(error: unknown, operation: string, cacheDirectory: string): Error {
  if (error instanceof GenerationConfigurationVisualizationCacheError) {
    return error;
  }
  return generationConfigurationVisualizationCacheError(
    'GENERATION_CONFIGURATION_VISUALIZATION_CACHE005',
    `Renku could not ${operation} the generation configuration visualization cache.`,
    [cacheDirectory],
    error instanceof Error ? error.message : undefined
  );
}
