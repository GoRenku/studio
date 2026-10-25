import { channel } from 'node:diagnostics_channel';
import type {
  CachedProviderMetadata,
  JsonValue,
  ProviderContext,
  ProviderMetadataCacheKey,
} from '../media/contracts.js';
import { EngineError } from './errors.js';
import { isJsonValue } from './json-object.js';
import { withProviderRetries } from './retry.js';
import { createRequestTimeoutFetch } from './request-timeout.js';

const inFlight = new Map<string, Promise<CachedProviderMetadata>>();

/** Freshness provider metadata loaders apply when a response carries no expiry headers. */
export const PROVIDER_CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const performanceChannel = channel('renku.performance');

export async function retrieveProviderMetadata(input: {
  key: ProviderMetadataCacheKey;
  context: ProviderContext;
  headers?: ConstructorParameters<typeof Headers>[0];
  /** A JSON body sends the request as a POST, for provider metadata that is only served that way. */
  body?: JsonValue;
  /** Freshness to apply when the provider response carries no expiry headers. */
  defaultMaxAgeMs?: number;
}): Promise<CachedProviderMetadata> {
  const started = performanceChannel.hasSubscribers ? performance.now() : undefined;
  let outcome = 'success';
  try {
    const cacheKey = JSON.stringify(input.key);
    const active = inFlight.get(cacheKey);
    if (active) {
      return await active;
    }
    const retrieval = retrieve(input).finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, retrieval);
    return await retrieval;
  } catch (error) {
    outcome = 'failure';
    throw error;
  } finally {
    if (started !== undefined) {
      performanceChannel.publish({ package: 'engines', phase: 'metadata', durationMs: performance.now() - started, outcome });
    }
  }
}

async function retrieve(input: {
  key: ProviderMetadataCacheKey;
  context: ProviderContext;
  headers?: ConstructorParameters<typeof Headers>[0];
  body?: JsonValue;
  defaultMaxAgeMs?: number;
}): Promise<CachedProviderMetadata> {
  const cached = await input.context.metadataCache.read(input.key);
  const now = (input.context.clock ?? (() => new Date()))();
  const reuse = input.context.cachedMetadataReuse;
  const cacheKey = JSON.stringify(input.key);
  if (cached && reuse && (now.getTime() - Date.parse(cached.fetchedAt) < reuse.maxAgeMs || reuse.failedRefreshes.has(cacheKey))) {
    return cached;
  }
  if (cached?.expiresAt && Date.parse(cached.expiresAt) > now.getTime()) {
    return cached;
  }
  try {
    return await refresh(input, cached, now, reuse ? 1 : 3);
  } catch (error) {
    if (reuse && cached && !(error instanceof EngineError && error.code === 'ENGINE_CANCELLED')) {
      reuse.failedRefreshes.add(cacheKey);
      return cached;
    }
    throw error;
  }
}

async function refresh(
  input: {
    key: ProviderMetadataCacheKey;
    context: ProviderContext;
    headers?: ConstructorParameters<typeof Headers>[0];
    body?: JsonValue;
    defaultMaxAgeMs?: number;
  },
  cached: CachedProviderMetadata | null,
  now: Date,
  maxAttempts: number,
): Promise<CachedProviderMetadata> {

  const headers = new Headers(input.headers);
  if (input.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (cached?.etag) {
    headers.set('If-None-Match', cached.etag);
  }
  if (cached?.lastModified) {
    headers.set('If-Modified-Since', cached.lastModified);
  }

  const response = await withProviderRetries({
    provider: input.key.provider,
    model: input.key.model,
    context: input.context,
    maxAttempts,
    operation: async () => {
      let result: Response;
      try {
        result = await createRequestTimeoutFetch({
          provider: input.key.provider,
          model: input.key.model,
          context: input.context,
        })(input.key.url, {
          ...(input.body === undefined ? {} : { method: 'POST', body: JSON.stringify(input.body) }),
          headers,
          signal: input.context.signal,
        });
      } catch (error) {
        throw new EngineError(
          input.context.signal.aborted
            ? 'ENGINE_CANCELLED'
            : 'ENGINE_METADATA_UNAVAILABLE',
          `Metadata for ${input.key.provider}/${input.key.model} is unavailable.`,
          {
            provider: input.key.provider,
            model: input.key.model,
            retryable: !input.context.signal.aborted,
            cause: error,
          },
        );
      }
      if (!result.ok && result.status !== 304) {
        throw new EngineError(
          'ENGINE_METADATA_UNAVAILABLE',
          `Metadata request for ${input.key.provider}/${input.key.model} failed with HTTP ${result.status}.`,
          {
            provider: input.key.provider,
            model: input.key.model,
            httpStatus: result.status,
            retryable: result.status === 429 || result.status >= 500,
            retryAfterMs: readRetryAfter(result, now),
          },
        );
      }
      return result;
    },
    classify: (error) => error instanceof EngineError
      ? { retryable: error.retryable, retryAfterMs: error.retryAfterMs }
      : { retryable: false },
  });

  if (response.status === 304 && cached) {
    const refreshed = {
      ...cached,
      fetchedAt: now.toISOString(),
      ...readCacheHeaders(response, now, input.defaultMaxAgeMs),
    };
    await input.context.metadataCache.write(input.key, refreshed);
    return refreshed;
  }
  const contentType = response.headers.get('content-type') ?? undefined;
  const body = await readBody(response, contentType, input.key, input.context.signal);
  const entry: CachedProviderMetadata = {
    body,
    contentType,
    fetchedAt: now.toISOString(),
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
    cacheControl: response.headers.get('cache-control') ?? undefined,
    ...readCacheHeaders(response, now, input.defaultMaxAgeMs),
  };
  if (!hasNoStore(entry.cacheControl)) {
    await input.context.metadataCache.write(input.key, entry);
  }
  return entry;
}

async function readBody(
  response: Response,
  contentType: string | undefined,
  key: ProviderMetadataCacheKey,
  signal: AbortSignal,
): Promise<JsonValue | string> {
  let value: unknown;
  try {
    value = contentType?.includes('json') ? await response.json() : await response.text();
  } catch (error) {
    throw new EngineError(
      signal.aborted ? 'ENGINE_CANCELLED' : 'ENGINE_METADATA_INVALID',
      `Metadata for ${key.provider}/${key.model} could not be read.`,
      { provider: key.provider, model: key.model, cause: error },
    );
  }
  if (typeof value === 'string') {
    return value;
  }
  if (!isJsonValue(value)) {
    throw new EngineError(
      'ENGINE_METADATA_INVALID',
      `Metadata for ${key.provider}/${key.model} is not JSON-safe.`,
      { provider: key.provider, model: key.model },
    );
  }
  return value;
}

function readCacheHeaders(response: Response, now: Date, defaultMaxAgeMs?: number): { expiresAt?: string } {
  const cacheControl = response.headers.get('cache-control');
  const maxAge = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
  if (maxAge) {
    return { expiresAt: new Date(now.getTime() + Number(maxAge) * 1000).toISOString() };
  }
  const expires = response.headers.get('expires');
  if (expires && Number.isFinite(Date.parse(expires))) {
    return { expiresAt: expires };
  }
  return defaultMaxAgeMs === undefined ? {} : { expiresAt: new Date(now.getTime() + defaultMaxAgeMs).toISOString() };
}

function readRetryAfter(response: Response, now: Date): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now.getTime()) : undefined;
}

function hasNoStore(cacheControl: string | undefined): boolean {
  return /(?:^|,)\s*no-store(?:,|$)/i.test(cacheControl ?? '');
}
