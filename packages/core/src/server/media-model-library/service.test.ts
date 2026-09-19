import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importPersonalMediaModel, listMediaModels, readMediaModel, removePersonalMediaModel } from './service.js';

let homeDir: string;
const route = { provider: 'fal-ai', apiId: 'example/unindexed', name: 'Personal model' };
const providerIds = ['fal-ai', 'pika'];
beforeEach(async () => { homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'model-library-'))); });
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(homeDir, { recursive: true, force: true });
});

function add(expectedRevision: string | null = null, model = route) {
  return importPersonalMediaModel({ homeDir, expectedRevision, route: model, providerIds });
}

describe('personal media model library', () => {
  it('stores a route without guides or a Project and preserves notes on removal', async () => {
    const empty = await listMediaModels({ homeDir });
    expect(empty.revision).toBeNull();
    expect(empty.routes).toEqual([]);
    const added = await add();
    const shown = await readMediaModel({ homeDir, ...route });
    expect(shown.route).toEqual({ ...route, source: 'personal', hasBundledEntry: false });
    await fs.mkdir(path.dirname(shown.personalGuidePath), { recursive: true });
    await fs.writeFile(shown.personalGuidePath, 'Keep my prompts concise.');
    await removePersonalMediaModel({ homeDir, ...route, expectedRevision: added.revision });
    expect((await readMediaModel({ homeDir, ...route })).route).toBeNull();
    expect(await fs.readFile(shown.personalGuidePath, 'utf8')).toBe('Keep my prompts concise.');
  });

  it('merges plugin replacements exactly and hashes the full effective list before filtering', async () => {
    const index = path.join(homeDir, 'plugin.json');
    const writePlugin = (routes: unknown[]) => fs.writeFile(index, JSON.stringify({ provider: 'fal-ai', routes }));
    await writePlugin([{ ...route, name: 'Bundled A', modelKey: 'missing-guide' }]);
    const added = await add();
    const { personalGuidePath } = await readMediaModel({ homeDir, ...route });
    await fs.mkdir(path.dirname(personalGuidePath), { recursive: true });
    const notes = 'Keep my prompts concise. Additional personal research.';
    await fs.writeFile(personalGuidePath, notes);
    const second = await add(added.revision, { ...route, apiId: `${route.apiId}:version` });
    await add(second.revision, { ...route, provider: 'pika' });
    const query = { homeDir, bundledRouteIndexPaths: [index] };
    const first = await listMediaModels(query);
    expect(first.routes).toHaveLength(3);
    expect(first.routes[0]).toEqual({ ...route, source: 'personal', hasBundledEntry: true });
    expect((await listMediaModels({ ...query, provider: 'pika' })).routeCatalogSha256).toBe(first.routeCatalogSha256);
    await writePlugin([{ ...route, name: 'Bundled B' }, { apiId: 'new/route', name: 'New route' }]);
    const updated = await listMediaModels(query);
    expect(updated.routes).toHaveLength(4);
    expect(updated.routeCatalogSha256).not.toBe(first.routeCatalogSha256);
    expect(updated.revision).toBe(first.revision);
    expect(await fs.readFile(personalGuidePath, 'utf8')).toBe(notes);
    await writePlugin([{ ...route, name: 'Bundled C', modelKey: 'improved-guide' }, { apiId: 'new/route', name: 'New route' }]);
    expect((await listMediaModels(query)).routeCatalogSha256).toBe(updated.routeCatalogSha256);
    expect(await fs.readFile(personalGuidePath, 'utf8')).toBe(notes);
    await removePersonalMediaModel({ homeDir, ...route, expectedRevision: updated.revision });
    expect((await readMediaModel({ ...query, ...route })).route?.name).toBe('Bundled C');
  });

  it('discovers bundled routes beneath symlinked Skill directories', async () => {
    const skill = path.join(homeDir, 'provider-skill');
    const linkedSkill = path.join(homeDir, 'installed-skill');
    await fs.mkdir(path.join(skill, 'references'), { recursive: true });
    await fs.symlink(skill, linkedSkill, 'junction');
    const index = path.join(skill, 'references', 'supported-routes.json');
    await fs.writeFile(index, JSON.stringify({ provider: route.provider, routes: [route] }));
    const direct = await listMediaModels({ homeDir, bundledRouteIndexPaths: [index] });
    const linked = await listMediaModels({ homeDir,
      bundledRouteIndexPaths: [path.join(linkedSkill, 'references', 'supported-routes.json')] });
    expect(linked).toEqual(direct);
    expect(linked.routes).toEqual([{ ...route, source: 'bundled', hasBundledEntry: true }]);
  });

  it('rejects missing, non-file, oversized and malformed bundled indexes beneath symlinked directories', async () => {
    const skill = path.join(homeDir, 'provider-skill');
    const linkedSkill = path.join(homeDir, 'installed-skill');
    await fs.mkdir(skill);
    await fs.symlink(skill, linkedSkill, 'junction');
    await fs.mkdir(path.join(skill, 'directory'));
    await fs.writeFile(path.join(skill, 'oversized.json'), ' '.repeat(1024 * 1024 + 1));
    await fs.writeFile(path.join(skill, 'malformed.json'), '{');
    for (const [name, code] of [
      ['missing.json', 'CORE_MEDIA_MODEL_LIBRARY_IO_FAILED'],
      ['directory', 'CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID'],
      ['oversized.json', 'CORE_MEDIA_MODEL_LIBRARY_INVALID'],
      ['malformed.json', 'CORE_MEDIA_MODEL_LIBRARY_INVALID'],
    ]) {
      await expect(listMediaModels({ homeDir, bundledRouteIndexPaths: [path.join(linkedSkill, name)] }))
        .rejects.toMatchObject({ code });
    }
  });

  it('preserves unrelated entries and rejects stale or busy concurrent writers', async () => {
    const first = await add();
    await expect(add()).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_CONFLICT' });
    const attempts = await Promise.allSettled([
      add(first.revision, { ...route, apiId: 'another/route' }),
      add(first.revision, { ...route, apiId: 'third/route' }),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await listMediaModels({ homeDir })).routes).toHaveLength(2);
    await fs.writeFile(`${first.libraryPath}.lock`, '');
    await expect(add(first.revision)).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_BUSY' });
  });

  it('adopts later bundled curation without hiding it or changing personal files and labels', async () => {
    const added = await add();
    const index = path.join(homeDir, 'plugin.json');
    await fs.writeFile(index, JSON.stringify({ provider: route.provider, routes: [] }));
    const query = { homeDir, bundledRouteIndexPaths: [index] };
    const before = await listMediaModels(query);
    expect(before.routes[0].hasBundledEntry).toBe(false);
    const { personalGuidePath } = await readMediaModel({ homeDir, ...route });
    await fs.mkdir(path.dirname(personalGuidePath), { recursive: true });
    await fs.writeFile(personalGuidePath, 'Explicit preference: keep my prompts concise.');
    const bytes = await fs.readFile(added.libraryPath);
    await fs.writeFile(index, JSON.stringify({ provider: route.provider,
      routes: [{ apiId: route.apiId, name: 'Curated name', modelKey: 'new-curation' }] }));
    const after = await listMediaModels(query);
    expect(after.routes).toEqual([{ ...route, source: 'personal', hasBundledEntry: true }]);
    expect(after.routeCatalogSha256).toBe(before.routeCatalogSha256);
    expect(await fs.readFile(added.libraryPath)).toEqual(bytes);
    expect(await fs.readFile(personalGuidePath, 'utf8')).toBe('Explicit preference: keep my prompts concise.');
  });

  it('fails on malformed, oversized, duplicate and unsafe documents without replacing them', async () => {
    const first = await add();
    for (const contents of ['{', 'x'.repeat(1024 * 1024 + 1), JSON.stringify({ formatVersion: 1, entries: [route, route] })]) {
      await fs.writeFile(first.libraryPath, contents);
      await expect(listMediaModels({ homeDir })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_INVALID' });
      await expect(add(first.revision)).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_INVALID' });
      expect(await fs.readFile(first.libraryPath, 'utf8')).toBe(contents);
    }
    await fs.unlink(first.libraryPath);
    await fs.symlink(path.join(homeDir, 'target'), first.libraryPath);
    await expect(listMediaModels({ homeDir })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID' });
  });

  it('rejects unsupported providers, invalid fields and missing personal removal targets', async () => {
    await expect(add(null, { ...route, provider: 'unknown' })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_PROVIDER_UNSUPPORTED' });
    await expect(importPersonalMediaModel({ homeDir, expectedRevision: null, providerIds,
      route: { ...route, schema: {} } })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_INVALID' });
    await expect(removePersonalMediaModel({ homeDir, ...route, expectedRevision: null })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_NOT_FOUND' });
    const shown = await readMediaModel({ homeDir, ...route });
    expect(shown.route).toBeNull();
    expect(shown.personalGuidePath).toMatch(/guides\/[a-f0-9]{64}\.md$/);
  });

  it('preserves the previous document and cleans up its lock and temporary file on replacement failure', async () => {
    const first = await add();
    const original = await fs.readFile(first.libraryPath, 'utf8');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('Disk unavailable'), { code: 'EIO' }));
    await expect(add(first.revision, { ...route, name: 'Changed' })).rejects.toMatchObject({
      code: 'CORE_MEDIA_MODEL_LIBRARY_IO_FAILED',
    });
    expect(await fs.readFile(first.libraryPath, 'utf8')).toBe(original);
    expect(await fs.readdir(path.dirname(first.libraryPath))).toEqual(['library.json']);
  });

  it('rejects symlinked storage directories and reports read IO failures', async () => {
    const result = await listMediaModels({ homeDir });
    const root = path.dirname(result.libraryPath);
    const target = path.join(homeDir, 'redirect');
    await fs.mkdir(target);
    await fs.mkdir(path.dirname(root), { recursive: true });
    await fs.symlink(target, root);
    await expect(listMediaModels({ homeDir })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID' });
    await expect(add()).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID' });
    expect(await fs.readdir(target)).toEqual([]);
    await fs.unlink(root);
    vi.spyOn(fs, 'open').mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));
    await expect(listMediaModels({ homeDir })).rejects.toMatchObject({ code: 'CORE_MEDIA_MODEL_LIBRARY_IO_FAILED' });
  });
});
