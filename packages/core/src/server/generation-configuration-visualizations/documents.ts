import crypto from 'node:crypto';
import {
  GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION,
  GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER,
  GENERATION_CONFIGURATION_VISUALIZATION_TEMPLATE_MAX_BYTES,
  type GenerationConfigurationVisualizationCacheManifest,
} from './contracts.js';
import { parseGenerationConfigurationVisualizationCacheDescriptor } from './descriptor.js';
import { generationConfigurationVisualizationCacheError } from './errors.js';

const SCHEMA_MAX_BYTES = 4_000_000;
const MAX_JSON_DEPTH = 100;
const MANIFEST_FIELDS = new Set([
  'formatVersion',
  'provider',
  'model',
  'operation',
  'inputMode',
  'routeCatalogSha256',
  'visualizeSkillVersion',
  'visualizeSkillSha256',
  'templateContractVersion',
  'templateContractSha256',
  'checkedAt',
  'expiresAt',
  'inputSchemaSha256',
  'templateSha256',
]);

export function parseGenerationConfigurationSchemaDocument(
  contents: string
): Record<string, unknown> {
  if (Buffer.byteLength(contents, 'utf8') > SCHEMA_MAX_BYTES) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE003',
      'The input schema exceeds the generation configuration cache size limit.',
      ['schema'],
      'Use the provider input schema for one exact executable route.'
    );
  }
  try {
    const value = JSON.parse(contents) as unknown;
    if (isRecord(value)) {
      return value;
    }
  } catch {
    // Report the same stable contract error below.
  }
  throw generationConfigurationVisualizationCacheError(
    'GENERATION_CONFIGURATION_VISUALIZATION_CACHE003',
    'The cached input schema must be a JSON object.',
    ['schema'],
    'Save the unmodified JSON result from generation schema show.'
  );
}

export function validateGenerationConfigurationVisualizationTemplate(
  template: string
): void {
  if (Buffer.byteLength(template, 'utf8') > GENERATION_CONFIGURATION_VISUALIZATION_TEMPLATE_MAX_BYTES) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002',
      'The visualization template exceeds the 1 MB fragment limit.',
      ['template']
    );
  }
  if (/<\/?(?:html|head|body)\b|<!doctype\b/i.test(template)) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002',
      'The visualization template must be an HTML fragment, not a full document.',
      ['template']
    );
  }
  if (template.split(GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER).length !== 2) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002',
      'The visualization template must contain exactly one Renku payload placeholder.',
      ['template'],
      `Include ${GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER} exactly once.`
    );
  }
  if (/<[^>]*\bid\s*=\s*["']renku-generation-configuration-payload["']/i.test(template)) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002',
      'The shared visualization template must not contain a materialized request payload.',
      ['template']
    );
  }
}

export function parseGenerationConfigurationVisualizationCacheManifest(
  contents: string
): GenerationConfigurationVisualizationCacheManifest | null {
  try {
    const value = JSON.parse(contents) as unknown;
    if (
      !isRecord(value)
      || value.formatVersion !== GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION
      || Object.keys(value).some((field) => !MANIFEST_FIELDS.has(field))
    ) {
      return null;
    }
    const descriptor = parseGenerationConfigurationVisualizationCacheDescriptor({
      provider: value.provider,
      model: value.model,
      operation: value.operation,
      inputMode: value.inputMode,
      routeCatalogSha256: value.routeCatalogSha256,
      visualizeSkillVersion: value.visualizeSkillVersion,
      visualizeSkillSha256: value.visualizeSkillSha256,
      templateContractVersion: value.templateContractVersion,
      templateContractSha256: value.templateContractSha256,
    });
    if (
      typeof value.checkedAt !== 'string'
      || !Number.isFinite(Date.parse(value.checkedAt))
      || typeof value.expiresAt !== 'string'
      || !Number.isFinite(Date.parse(value.expiresAt))
      || !isSha256(value.inputSchemaSha256)
      || !isSha256(value.templateSha256)
    ) {
      return null;
    }
    return {
      formatVersion: GENERATION_CONFIGURATION_VISUALIZATION_CACHE_FORMAT_VERSION,
      ...descriptor,
      checkedAt: value.checkedAt,
      expiresAt: value.expiresAt,
      inputSchemaSha256: value.inputSchemaSha256.toLowerCase(),
      templateSha256: value.templateSha256.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function hashGenerationConfigurationSchema(
  schema: Record<string, unknown>
): string {
  return sha256(canonicalJson(schema));
}

export function hashGenerationConfigurationTemplate(template: string): string {
  return sha256(template);
}

function canonicalJson(value: unknown, depth = 0): string {
  if (depth > MAX_JSON_DEPTH) {
    throw generationConfigurationVisualizationCacheError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE003',
      'The cached input schema exceeds the supported JSON nesting depth.',
      ['schema']
    );
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry, depth + 1)).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key], depth + 1)}`
    ).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
