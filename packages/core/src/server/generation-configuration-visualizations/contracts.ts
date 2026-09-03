import type { RenkuConfigPathOptions } from '../config/index.js';

export const GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION = 1 as const;
export const GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
export const GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER =
  '<!--__RENKU_GENERATION_CONFIGURATION_PAYLOAD__-->' as const;
export const GENERATION_CONFIGURATION_VISUALIZATION_TEMPLATE_MAX_BYTES = 1_000_000;

export interface GenerationConfigurationVisualizationCacheDescriptor {
  provider: string;
  model: string;
  operation: string;
  inputMode: string;
  routeCatalogSha256: string;
  visualizeSkillVersion: string;
  visualizeSkillSha256: string;
  templateContractVersion: number;
  templateContractSha256: string;
}

export interface GenerationConfigurationVisualizationCacheManifest
  extends GenerationConfigurationVisualizationCacheDescriptor {
  formatVersion: typeof GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION;
  checkedAt: string;
  expiresAt: string;
  inputSchemaSha256: string;
  templateSha256: string;
}

export interface GenerationConfigurationVisualizationCachePaths {
  cacheDirectory: string;
  manifestPath: string;
  schemaPath: string;
  templatePath: string;
}

export type GenerationConfigurationVisualizationCacheInspection =
  | (GenerationConfigurationVisualizationCachePaths & {
      status: 'miss';
    })
  | (GenerationConfigurationVisualizationCachePaths & {
      status: 'invalid' | 'incompatible';
      reason: string;
    })
  | (GenerationConfigurationVisualizationCachePaths & {
      status: 'fresh' | 'expired';
      manifest: GenerationConfigurationVisualizationCacheManifest;
    });

export interface GenerationConfigurationVisualizationCacheOptions
  extends RenkuConfigPathOptions {
  now?: () => Date;
}
