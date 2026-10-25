import type { CostEstimate, CostQuote, RoutePrice } from '../pricing/contracts.js';

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
  reviewLabel?: string;
  promptMention?: string;
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
  /**
   * Set while estimating cost: cached provider metadata younger than
   * `maxAgeMs` is used as is, an older entry gets one refresh attempt, and a
   * failed refresh falls back to the cached copy. `failedRefreshes` holds the
   * entries whose refresh already failed in this estimate, so they are not
   * tried again.
   */
  cachedMetadataReuse?: { maxAgeMs: number; failedRefreshes: Set<string> };
}

export interface ProviderExecutionContext extends ProviderContext {
  outputDirectory: string;
}

export interface MediaProvider {
  readonly id: string;
  /** The provider's API price for a route, or null when the provider publishes none. */
  readPrice?(model: string, context: ProviderContext): Promise<RoutePrice | null>;
  /** The provider's quote for one native request, used when its price cannot be computed from the request. */
  quoteCost?(model: string, request: JsonValue, context: ProviderContext): Promise<CostQuote>;
  readInputSchema?(
    model: string,
    context: ProviderContext,
  ): Promise<JsonValue>;
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
  readonly providerIds: readonly string[];
  readInputSchema(
    provider: string,
    model: string,
    context: ProviderContext,
  ): Promise<JsonValue>;
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
  estimateCost(
    provider: string,
    request: ProviderRequest,
    context: ProviderContext,
  ): Promise<CostEstimate>;
  /**
   * One output of a route at its schema defaults, for comparing routes before a
   * request exists. `fields` set native fields over the defaults, such as an
   * output size.
   */
  estimateRouteDefaultsCost(
    provider: string,
    model: string,
    context: ProviderContext,
    fields?: Record<string, JsonValue>,
  ): Promise<CostEstimate>;
  /** The saved price estimates use for one route: a researched entry, else the provider API price. */
  readRoutePrice(
    provider: string,
    model: string,
    context: ProviderContext,
  ): Promise<RoutePrice | null>;
  recordRoutePrice(
    provider: string,
    model: string,
    price: unknown,
    context: ProviderContext,
  ): Promise<RoutePrice>;
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
