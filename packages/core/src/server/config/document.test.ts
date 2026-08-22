import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  initRenkuConfig,
  readRenkuConfig,
  resolveRenkuStorageRoot,
} from './document.js';
import { RenkuConfigError } from './errors.js';
import { resolveRenkuConfigPath } from './paths.js';

describe('Renku config document', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-config-test-'));
  });

  it('initializes camelCase YAML with an explicit storage root', async () => {
    const storageRoot = path.join(homeDir, 'projects');
    const result = await initRenkuConfig(storageRoot, { homeDir });

    expect(result).toMatchObject({ status: 'created', storageRoot });
    await expect(readRenkuConfig({ homeDir })).resolves.toEqual({
      version: '0.1.0',
      storageRoot,
    });
    const configYaml = await fs.readFile(resolveRenkuConfigPath({ homeDir }), 'utf8');
    expect(configYaml).toContain('version: 0.1.0');
    expect(configYaml).toContain(`storageRoot: ${storageRoot}`);
    expect(configYaml).not.toContain('storage_root');
  });

  it('reads a configured storage root and honors an explicit override', async () => {
    const storageRoot = path.join(homeDir, 'library');
    await initRenkuConfig(storageRoot, { homeDir });

    await expect(resolveRenkuStorageRoot({ homeDir })).resolves.toBe(storageRoot);
    await expect(
      resolveRenkuStorageRoot({ homeDir, storageRoot: path.join(homeDir, 'other') })
    ).resolves.toBe(path.join(homeDir, 'other'));
  });

  it('reports an existing config without rewriting it', async () => {
    const firstStorageRoot = path.join(homeDir, 'first');
    await initRenkuConfig(firstStorageRoot, { homeDir });
    const configPath = resolveRenkuConfigPath({ homeDir });
    const before = await fs.readFile(configPath, 'utf8');

    const result = await initRenkuConfig(path.join(homeDir, 'second'), { homeDir });

    expect(result).toMatchObject({ status: 'existing', storageRoot: firstStorageRoot });
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe(before);
  });

  it('fails when config is missing', async () => {
    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG002',
    });
  });

  it.each([
    ['version: [\n', 'CONFIG003'],
    ['- version\n- 0.1.0\n', 'CONFIG004'],
    ['version: 0.2.0\nstorageRoot: /tmp/movies\n', 'CONFIG006'],
    ['version: 0.1.0\n', 'CONFIG007'],
    ['version: 0.1.0\nstorageRoot: 123\n', 'CONFIG007'],
    [`version: 0.1.0\nstorage_root: ${path.join(os.tmpdir(), 'movies')}\n`, 'CONFIG005'],
    [`version: 0.1.0\nstorageRoot: ${path.join(os.tmpdir(), 'movies')}\nextra: true\n`, 'CONFIG013'],
  ])('rejects an invalid config document with %s', async (contents, code) => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, contents, 'utf8');

    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({ code });
  });

  it('fails when the storage root conflicts with a file', async () => {
    const storageRoot = path.join(homeDir, 'not-a-directory');
    await fs.writeFile(storageRoot, 'file', 'utf8');

    await expect(initRenkuConfig(storageRoot, { homeDir })).rejects.toBeInstanceOf(
      RenkuConfigError
    );
    await expect(initRenkuConfig(storageRoot, { homeDir })).rejects.toMatchObject({
      code: 'CONFIG008',
    });
  });

  it('rejects an empty initialization value', async () => {
    await expect(initRenkuConfig('  ', { homeDir })).rejects.toMatchObject({
      code: 'CONFIG001',
    });
  });

  it('rejects a config path that is not a regular file', async () => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(configPath, { recursive: true });

    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG009',
    });
  });
});
