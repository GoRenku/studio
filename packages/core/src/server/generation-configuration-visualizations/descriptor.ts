import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationConfigurationVisualizationCacheDescriptor } from './contracts.js';
import { GenerationConfigurationVisualizationCacheError } from './errors.js';

const DESCRIPTOR_FIELDS = new Set([
  'provider',
  'model',
  'operation',
  'inputMode',
  'routeCatalogSha256',
  'visualizeSkillVersion',
  'visualizeSkillSha256',
  'templateContractVersion',
  'templateContractSha256',
]);
const PATH_SEGMENT_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._:-]+$/;
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;

export function parseGenerationConfigurationVisualizationCacheDescriptor(
  value: unknown
): GenerationConfigurationVisualizationCacheDescriptor {
  const issues: DiagnosticIssue[] = [];
  if (!isRecord(value)) {
    throw invalidDescriptor([
      createDiagnosticError(
        'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
        'The cache descriptor must be a JSON object.',
        { path: [], context: 'generation configuration visualization cache' }
      ),
    ]);
  }

  for (const field of Object.keys(value)) {
    if (!DESCRIPTOR_FIELDS.has(field)) {
      issues.push(createDiagnosticError(
        'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
        `Unknown cache descriptor field: ${field}.`,
        { path: [field], context: 'generation configuration visualization cache' }
      ));
    }
  }

  const provider = pathSegment(value.provider, 'provider', issues);
  const model = modelPath(value.model, issues);
  const operation = pathSegment(value.operation, 'operation', issues);
  const inputMode = pathSegment(value.inputMode, 'inputMode', issues);
  const routeCatalogSha256 = sha256(value.routeCatalogSha256, 'routeCatalogSha256', issues);
  const visualizeSkillVersion = version(value.visualizeSkillVersion, issues);
  const visualizeSkillSha256 = sha256(value.visualizeSkillSha256, 'visualizeSkillSha256', issues);
  const templateContractVersion = positiveInteger(
    value.templateContractVersion,
    'templateContractVersion',
    issues
  );
  const templateContractSha256 = sha256(
    value.templateContractSha256,
    'templateContractSha256',
    issues
  );

  if (issues.length > 0) {
    throw invalidDescriptor(issues);
  }
  return {
    provider: provider!,
    model: model!,
    operation: operation!,
    inputMode: inputMode!,
    routeCatalogSha256: routeCatalogSha256!,
    visualizeSkillVersion: visualizeSkillVersion!,
    visualizeSkillSha256: visualizeSkillSha256!,
    templateContractVersion: templateContractVersion!,
    templateContractSha256: templateContractSha256!,
  };
}

function pathSegment(
  value: unknown,
  field: string,
  issues: DiagnosticIssue[]
): string | undefined {
  if (typeof value !== 'string' || value.length > 128 || !PATH_SEGMENT_PATTERN.test(value)) {
    issues.push(createDiagnosticError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
      `${field} must be one safe route segment containing letters, numbers, dots, underscores, colons, or hyphens.`,
      { path: [field], context: 'generation configuration visualization cache' }
    ));
    return undefined;
  }
  return value;
}

function modelPath(value: unknown, issues: DiagnosticIssue[]): string | undefined {
  if (
    typeof value !== 'string'
    || value.length > 512
    || value.split('/').some((segment) => !PATH_SEGMENT_PATTERN.test(segment))
  ) {
    issues.push(createDiagnosticError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
      'model must contain one or more safe slash-separated path segments.',
      { path: ['model'], context: 'generation configuration visualization cache' }
    ));
    return undefined;
  }
  return value;
}

function sha256(
  value: unknown,
  field: string,
  issues: DiagnosticIssue[]
): string | undefined {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    issues.push(createDiagnosticError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
      `${field} must be a 64-character SHA-256 digest.`,
      { path: [field], context: 'generation configuration visualization cache' }
    ));
    return undefined;
  }
  return value.toLowerCase();
}

function version(value: unknown, issues: DiagnosticIssue[]): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    issues.push(createDiagnosticError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
      'visualizeSkillVersion must be a non-empty version string.',
      { path: ['visualizeSkillVersion'], context: 'generation configuration visualization cache' }
    ));
    return undefined;
  }
  return value;
}

function positiveInteger(
  value: unknown,
  field: string,
  issues: DiagnosticIssue[]
): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    issues.push(createDiagnosticError(
      'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
      `${field} must be a positive integer.`,
      { path: [field], context: 'generation configuration visualization cache' }
    ));
    return undefined;
  }
  return value;
}

function invalidDescriptor(issues: DiagnosticIssue[]) {
  return new GenerationConfigurationVisualizationCacheError(
    'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
    'Generation configuration visualization cache descriptor is invalid.',
    {
      issues,
      suggestion: 'Use the exact provider route, operation, input mode, and current dependency fingerprints.',
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
