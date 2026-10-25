import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type {
  CachedProviderMetadata,
  ProviderMetadataCache,
  ProviderMetadataCacheKey,
} from '../media/contracts.js';
import { EngineError } from './errors.js';
import { isJsonValue, isUnknownObject } from './json-object.js';

export function createMemoryProviderMetadataCache(): ProviderMetadataCache {
  const entries = new Map<string, CachedProviderMetadata>();
  return {
    async read(key) {
      const entry = entries.get(serializeCacheKey(key));
      return entry ? structuredClone(entry) : null;
    },
    async write(key, entry) {
      entries.set(serializeCacheKey(key), structuredClone(entry));
    },
    async remove(key) {
      entries.delete(serializeCacheKey(key));
    },
  };
}

export function createFileSystemProviderMetadataCache(
  directory: string,
): ProviderMetadataCache {
  return {
    async read(key) {
      try {
        const value = JSON.parse(await readFile(cachePath(directory, key), 'utf8')) as unknown;
        return isCachedProviderMetadata(value) ? value : null;
      } catch (error) {
        if (isMissingFile(error)) {
          return null;
        }
        await this.remove(key);
        return null;
      }
    },
    async write(key, entry) {
      const destination = cachePath(directory, key);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(temporary, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600 });
        await rename(temporary, destination);
      } catch (error) {
        throw isPermissionDenied(error) ? cacheUnwritable(directory, key, error) : error;
      }
    },
    async remove(key) {
      try {
        await unlink(cachePath(directory, key));
      } catch (error) {
        if (!isMissingFile(error)) {
          throw error;
        }
      }
    },
  };
}

export function serializeCacheKey(key: ProviderMetadataCacheKey): string {
  return JSON.stringify([
    key.provider,
    key.model,
    key.url,
    key.contractVersion ?? null,
  ]);
}

function cachePath(directory: string, key: ProviderMetadataCacheKey): string {
  const digest = createHash('sha256').update(serializeCacheKey(key)).digest('hex');
  return join(directory, `${digest}.json`);
}

function isCachedProviderMetadata(value: unknown): value is CachedProviderMetadata {
  return isUnknownObject(value)
    && (typeof value.body === 'string' || isJsonValue(value.body))
    && typeof value.fetchedAt === 'string';
}

/** The cache folder exists outside what this process may write, such as a sandbox's writable folders. */
function cacheUnwritable(directory: string, key: ProviderMetadataCacheKey, cause: unknown): EngineError {
  return new EngineError(
    'ENGINE_METADATA_CACHE_UNWRITABLE',
    `Renku cannot save provider data in ${directory}: writing there is not permitted.`,
    { provider: key.provider, model: key.model, details: { directory }, cause },
  );
}

function isPermissionDenied(error: unknown): boolean {
  return isUnknownObject(error) && (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS');
}

function isMissingFile(error: unknown): boolean {
  return isUnknownObject(error) && error.code === 'ENOENT';
}
