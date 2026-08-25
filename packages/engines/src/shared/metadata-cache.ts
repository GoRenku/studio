import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type {
  CachedProviderMetadata,
  ProviderMetadataCache,
  ProviderMetadataCacheKey,
} from '../media/contracts.js';

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
      await mkdir(directory, { recursive: true });
      const destination = cachePath(directory, key);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, destination);
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
  return isRecord(value)
    && (typeof value.body === 'string' || isJsonValue(value.body))
    && typeof value.fetchedAt === 'string';
}

function isJsonValue(value: unknown, depth = 0): boolean {
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
  return isRecord(value)
    && Object.values(value).every((entry) => isJsonValue(entry, depth + 1));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
