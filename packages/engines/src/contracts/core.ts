import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

export type Id = string;
export type ArtifactKind = string;
export type ProviderName = string;
export type ProviderEnvironment = 'local' | 'cloud';
export type RevisionId = `rev-${string}` | string;
export type ArtifactEventStatus = 'succeeded' | 'failed' | 'skipped';

export interface Logger {
  debug?(message: string, meta?: unknown): void;
  info?(message: string, meta?: unknown): void;
  warn?(message: string, meta?: unknown): void;
  error?(message: string, meta?: unknown): void;
}

export interface NotificationBus {
  publish(event: {
    type: 'progress' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }): void;
}

export interface ProviderAttachment {
  name: string;
  contents: string;
  format: 'json' | 'toml' | 'text';
}

export interface ProducedBlobOutput {
  data: Uint8Array | string;
  mimeType: string;
}

export interface ProducedArtifact {
  artifactId: Id;
  status?: ArtifactEventStatus;
  blob?: ProducedBlobOutput;
  diagnostics?: Record<string, unknown>;
}

export interface BlobInput {
  data: Buffer | Uint8Array;
  mimeType: string;
}

export function isBlobInput(value: unknown): value is BlobInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'mimeType' in value &&
    (Buffer.isBuffer((value as BlobInput).data) ||
      (value as BlobInput).data instanceof Uint8Array)
  );
}

export interface ArrayDimensionMapping {
  path: string;
  countInput: string;
  countInputOffset?: number;
}

export interface JsonSchemaDefinition {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchemaDefinition>;
  items?: JsonSchemaDefinition;
  required?: string[];
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchemaDefinition;
}

export interface BlueprintOutputDefinition {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  itemType?: string;
  countInput?: string;
  countInputOffset?: number;
  arrays?: ArrayDimensionMapping[];
  schema?: JsonSchemaDefinition;
}

export interface MappingCondition {
  input: string;
  equals?: unknown;
  notEmpty?: boolean;
  empty?: boolean;
}

export interface CombineTransform {
  inputs: string[];
  table: Record<string, unknown>;
}

export interface ConditionalTransform {
  when: MappingCondition;
  then: MappingFieldDefinition;
}

export interface DurationToFramesConfig {
  fps: number;
}

export type ResolutionProjectionMode =
  | 'aspectRatio'
  | 'preset'
  | 'sizeToken'
  | 'sizeTokenNearest'
  | 'aspectRatioAndPreset'
  | 'width'
  | 'height'
  | 'megapixelsNearest';

export interface ResolutionObjectFieldConfig {
  mode: ResolutionProjectionMode;
  transform?: Record<string, unknown>;
  megapixelCandidates?: number[];
  megapixelSuffix?: string;
}

export interface ResolutionTransformConfig {
  mode:
    | ResolutionProjectionMode
    | 'aspectRatioAndPresetObject'
    | 'aspectRatioAndSizeTokenObject'
    | 'object';
  aspectRatioField?: string;
  presetField?: string;
  sizeTokenField?: string;
  fields?: Record<string, ResolutionObjectFieldConfig>;
  megapixelCandidates?: number[];
  megapixelSuffix?: string;
}

export interface MappingFieldDefinition {
  input?: string;
  field?: string;
  type?: string;
  transform?: Record<string, unknown>;
  expand?: boolean;
  combine?: CombineTransform;
  conditional?: ConditionalTransform;
  firstOf?: boolean;
  asArray?: boolean;
  invert?: boolean;
  intToString?: boolean;
  intToSecondsString?: boolean;
  durationToFrames?: DurationToFramesConfig;
  resolution?: ResolutionTransformConfig;
}

export interface BlueprintProducerSdkMappingField extends MappingFieldDefinition {}

export type MappingValue = string | MappingFieldDefinition;

export const SdkErrorCode = {
  INVALID_CONFIG: 'S001',
  MISSING_REQUIRED_INPUT: 'S002',
  MISSING_INPUT_SCHEMA: 'S003',
  UNKNOWN_ARTIFACT: 'S004',
  MISSING_FANIN_DATA: 'S011',
  MISSING_STORAGE_ROOT: 'S012',
  MISSING_ASSET: 'S014',
  MISSING_DURATION: 'S015',
  FFMPEG_NOT_FOUND: 'S023',
  RENDER_FAILED: 'S024',
  RATE_LIMITED: 'S030',
  PROVIDER_PREDICTION_FAILED: 'S031',
  SCHEMA_VALIDATION_FAILED: 'S032',
  QUOTA_EXCEEDED: 'S034',
  INVALID_API_KEY: 'S035',
  INVALID_VOICE: 'S036',
  SUBSCRIPTION_REQUIRED: 'S037',
  CHARACTER_LIMIT_EXCEEDED: 'S038',
  SYSTEM_BUSY: 'S039',
  MISSING_FIELD_PROPERTY: 'S040',
  CANNOT_EXPAND_NON_OBJECT: 'S041',
  INVALID_CONDITION_CONFIG: 'S042',
  BLOB_INPUT_NO_STORAGE: 'S043',
  COMBINE_REQUIRES_FIELD: 'S044',
  INVALID_INDEXED_INPUT_ACCESS: 'S045',
  FFMPEG_EXTRACTION_FAILED: 'S050',
  FFMPEG_NO_AUDIO_STREAM: 'S051',
  FFMPEG_TEMP_FILE_ERROR: 'S052',
  EMPTY_AUDIO_SEGMENTS: 'S060',
  EMPTY_TRANSCRIPTION_RESULT: 'S061',
} as const;

export type SdkErrorCodeValue =
  (typeof SdkErrorCode)[keyof typeof SdkErrorCode];

export function isCanonicalInputId(value: string): boolean {
  return typeof value === 'string' && value.startsWith('Input:');
}

export function isCanonicalOutputId(value: string): boolean {
  return typeof value === 'string' && value.startsWith('Output:');
}

export function isCanonicalArtifactId(value: string): boolean {
  return typeof value === 'string' && value.startsWith('Artifact:');
}

export function isCanonicalProducerId(value: string): boolean {
  return typeof value === 'string' && value.startsWith('Producer:');
}

export function isCanonicalId(value: string): boolean {
  return (
    isCanonicalInputId(value) ||
    isCanonicalOutputId(value) ||
    isCanonicalArtifactId(value) ||
    isCanonicalProducerId(value)
  );
}

type PathToken = string | number;

export interface ResolveResult<T = unknown> {
  value?: T;
  exists: boolean;
}

export function readJsonPath<T = unknown>(
  source: unknown,
  path: string
): ResolveResult<T> {
  if (!path) {
    return { exists: false };
  }
  const tokens = tokenizeJsonPath(path);
  let current: unknown = source;
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return { exists: false };
    }
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token < 0 || token >= current.length) {
        return { exists: false };
      }
      current = current[token];
      continue;
    }
    if (typeof current !== 'object') {
      return { exists: false };
    }
    if (!(token in (current as Record<string, unknown>))) {
      return { exists: false };
    }
    current = (current as Record<string, unknown>)[token];
  }
  return { exists: true, value: current as T };
}

function tokenizeJsonPath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  let buffer = '';
  let indexBuffer = '';
  let inBracket = false;

  for (const char of path) {
    if (inBracket) {
      if (char === ']') {
        if (indexBuffer.trim().length === 0) {
          throw new Error(`Invalid JSON path "${path}": empty index.`);
        }
        const index = Number.parseInt(indexBuffer, 10);
        if (Number.isNaN(index)) {
          throw new Error(
            `Invalid JSON path "${path}": non-numeric index "${indexBuffer}".`
          );
        }
        tokens.push(index);
        indexBuffer = '';
        inBracket = false;
      } else {
        indexBuffer += char;
      }
      continue;
    }

    if (char === '.') {
      if (buffer.length > 0) {
        tokens.push(buffer);
        buffer = '';
      }
      continue;
    }
    if (char === '[') {
      if (buffer.length > 0) {
        tokens.push(buffer);
        buffer = '';
      }
      inBracket = true;
      continue;
    }
    buffer += char;
  }

  if (inBracket) {
    throw new Error(`Invalid JSON path "${path}": missing closing bracket.`);
  }
  if (buffer.length > 0) {
    tokens.push(buffer);
  }
  return tokens;
}

const EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'application/json': 'json',
  'text/plain': 'txt',
};

export function inferBlobExtension(mimeType?: string): string | null {
  if (!mimeType) {
    return null;
  }
  const normalized = mimeType.toLowerCase();
  if (EXTENSION_MAP[normalized]) {
    return EXTENSION_MAP[normalized];
  }
  if (normalized.startsWith('audio/')) {
    return normalized.slice('audio/'.length);
  }
  if (normalized.startsWith('video/')) {
    return normalized.slice('video/'.length);
  }
  if (normalized.startsWith('image/')) {
    return normalized.slice('image/'.length);
  }
  return null;
}

export interface EnvLoaderOptions {
  verbose?: boolean;
}

export interface EnvLoaderResult {
  loaded: string[];
}

export function loadEnv(
  callerUrl: string,
  options: EnvLoaderOptions = {}
): EnvLoaderResult {
  const cwd = dirname(fileURLToPath(callerUrl));
  const candidates = [
    resolve(cwd, '.env'),
    resolve(cwd, '..', '.env'),
    resolve(cwd, '..', '..', '.env'),
  ];
  const loaded: string[] = [];

  for (const file of candidates) {
    try {
      const contents = readFileSync(file, 'utf8');
      applyEnvFile(contents);
      loaded.push(file);
      if (options.verbose) {
        console.info(`Loaded env file ${file}`);
      }
    } catch {
      // Optional local env files are intentionally absent in most test runs.
    }
  }

  return { loaded };
}

function applyEnvFile(contents: string): void {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}
