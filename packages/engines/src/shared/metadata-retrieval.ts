import type {
  CachedProviderMetadata,
  JsonValue,
  ProviderContext,
  ProviderMetadataCacheKey,
} from '../media/contracts.js';
import { EngineError } from './errors.js';
import { withProviderRetries } from './retry.js';
import { createRequestTimeoutFetch } from './request-timeout.js';

const inFlight = new Map<string, Promise<CachedProviderMetadata>>();

export async function retrieveProviderMetadata(input: {
  key: ProviderMetadataCacheKey;
  context: ProviderContext;
  headers?: ConstructorParameters<typeof Headers>[0];
}): Promise<CachedProviderMetadata> {
  const cacheKey = JSON.stringify(input.key);
  const active = inFlight.get(cacheKey);
  if (active) {
    return active;
  }
  const retrieval = retrieve(input).finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, retrieval);
  return retrieval;
}

async function retrieve(input: {
  key: ProviderMetadataCacheKey;
  context: ProviderContext;
  headers?: ConstructorParameters<typeof Headers>[0];
}): Promise<CachedProviderMetadata> {
  const cached = await input.context.metadataCache.read(input.key);
  const now = (input.context.clock ?? (() => new Date()))();
  if (cached?.expiresAt && Date.parse(cached.expiresAt) > now.getTime()) {
    return cached;
  }

  const headers = new Headers(input.headers);
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
    maxAttempts: 3,
    operation: async () => {
      let result: Response;
      try {
        result = await createRequestTimeoutFetch({
          provider: input.key.provider,
          model: input.key.model,
          context: input.context,
        })(input.key.url, {
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
      ...readCacheHeaders(response, now),
    };
    await input.context.metadataCache.write(input.key, refreshed);
    return refreshed;
  }
  const contentType = response.headers.get('content-type') ?? undefined;
  const body = await readBody(response, contentType, input.key);
  const entry: CachedProviderMetadata = {
    body,
    contentType,
    fetchedAt: now.toISOString(),
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
    cacheControl: response.headers.get('cache-control') ?? undefined,
    ...readCacheHeaders(response, now),
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
): Promise<JsonValue | string> {
  if (!contentType?.includes('json')) {
    return response.text();
  }
  const value = await response.json() as unknown;
  if (!isJsonValue(value)) {
    throw new EngineError(
      'ENGINE_METADATA_INVALID',
      `Metadata for ${key.provider}/${key.model} is not JSON-safe.`,
      { provider: key.provider, model: key.model },
    );
  }
  return value;
}

function readCacheHeaders(response: Response, now: Date): { expiresAt?: string } {
  const cacheControl = response.headers.get('cache-control');
  const maxAge = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
  if (maxAge) {
    return { expiresAt: new Date(now.getTime() + Number(maxAge) * 1000).toISOString() };
  }
  const expires = response.headers.get('expires');
  return expires && Number.isFinite(Date.parse(expires)) ? { expiresAt: expires } : {};
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

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 100) {
    return false;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry, depth + 1));
  }
  return value !== null
    && typeof value === 'object'
    && Object.values(value).every((entry) => isJsonValue(entry, depth + 1));
}
