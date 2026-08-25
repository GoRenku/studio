export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface LocalMediaFile {
  $file: string;
  mimeType?: string;
}

export interface ProviderRequest {
  model: string;
  input: JsonValue;
}

export interface ProviderRecoveryRequest extends ProviderRequest {
  requestId: string;
}

export interface EngineLogger {
  debug?(message: string, details?: Record<string, JsonValue>): void;
  info?(message: string, details?: Record<string, JsonValue>): void;
  warn?(message: string, details?: Record<string, JsonValue>): void;
  error?(message: string, details?: Record<string, JsonValue>): void;
}

export interface ProviderContext {
  credential: string;
  metadataCache: ProviderMetadataCache;
  fetch: typeof globalThis.fetch;
  logger?: EngineLogger;
  clock?: () => Date;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
  signal: AbortSignal;
  requestTimeoutMs: number;
  operationTimeoutMs: number;
}

export interface ProviderExecutionContext extends ProviderContext {
  outputDirectory: string;
}

export interface MediaProvider {
  readonly id: string;
  validate(request: ProviderRequest, context: ProviderContext): Promise<void>;
  execute(
    request: ProviderRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderExecutionResult>;
  recover?(
    request: ProviderRecoveryRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderExecutionResult>;
}

export interface ProviderExecutionResult {
  provider: string;
  model: string;
  requestId?: string;
  artifacts: GeneratedMediaArtifact[];
  receipt?: JsonValue;
}

export interface MediaEngine {
  validate(
    provider: string,
    request: ProviderRequest,
    context: ProviderContext,
  ): Promise<void>;
  execute(
    provider: string,
    request: ProviderRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderExecutionResult>;
  recover(
    provider: string,
    request: ProviderRecoveryRequest,
    context: ProviderExecutionContext,
  ): Promise<ProviderExecutionResult>;
}

export interface GeneratedMediaArtifact {
  path: string;
  mimeType: string;
  byteLength: number;
  providerOutput?: JsonValue;
}

export interface ProviderMetadataCache {
  read(key: ProviderMetadataCacheKey): Promise<CachedProviderMetadata | null>;
  write(
    key: ProviderMetadataCacheKey,
    entry: CachedProviderMetadata,
  ): Promise<void>;
  remove(key: ProviderMetadataCacheKey): Promise<void>;
}

export interface ProviderMetadataCacheKey {
  provider: string;
  model: string;
  url: string;
  contractVersion?: string;
}

export interface CachedProviderMetadata {
  body: JsonValue | string;
  contentType?: string;
  fetchedAt: string;
  expiresAt?: string;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
}
