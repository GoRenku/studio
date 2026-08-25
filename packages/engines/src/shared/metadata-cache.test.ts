import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFileSystemProviderMetadataCache, createMemoryProviderMetadataCache } from './metadata-cache.js';

const key = { provider: 'atlas', model: 'image-v1', url: 'https://atlas.invalid/schema' };
const entry = { body: { type: 'object' }, fetchedAt: '2026-08-24T00:00:00.000Z', etag: 'schema-1' };

describe('provider metadata caches', () => {
  it('reads, overwrites, and removes memory entries without exposing mutable state', async () => {
    const cache = createMemoryProviderMetadataCache();
    await cache.write(key, entry);
    const first = await cache.read(key);
    (first!.body as { type: string }).type = 'changed';
    expect(await cache.read(key)).toEqual(entry);
    await cache.remove(key);
    expect(await cache.read(key)).toBeNull();
  });

  it('writes filesystem entries atomically and discards corruption', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-engine-cache-'));
    const cache = createFileSystemProviderMetadataCache(directory);
    await cache.write(key, entry);
    expect(await cache.read(key)).toEqual(entry);
    const [file] = await fs.readdir(directory);
    await fs.writeFile(path.join(directory, file!), '{');
    expect(await cache.read(key)).toBeNull();
    expect(await fs.readdir(directory)).toEqual([]);
  });
});
