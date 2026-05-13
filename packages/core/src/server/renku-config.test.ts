import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  RenkuConfigError,
  initRenkuConfig,
  readRenkuConfig,
  resolveRenkuConfigDir,
  resolveRenkuConfigPath,
  resolveRenkuStorageRoot,
} from './renku-config.js';

describe('Renku config', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-config-test-'));
  });

  it('resolves the fixed global config paths', () => {
    expect(resolveRenkuConfigDir({ homeDir })).toBe(
      path.join(homeDir, '.config', 'renku')
    );
    expect(resolveRenkuConfigPath({ homeDir })).toBe(
      path.join(homeDir, '.config', 'renku', 'config.yaml')
    );
  });

  it('initializes config with an explicit absolute storage root', async () => {
    const storageRootInput = path.join(homeDir, 'movies');

    const result = await initRenkuConfig(storageRootInput, { homeDir });

    expect(result.status).toBe('created');
    expect(result.configPath).toBe(
      path.join(homeDir, '.config', 'renku', 'config.yaml')
    );
    expect(result.storageRoot).toBe(storageRootInput);
    await expect(fs.stat(storageRootInput)).resolves.toHaveProperty('isDirectory');
    await expect(readRenkuConfig({ homeDir })).resolves.toEqual({
      version: '0.1.0',
      storageRoot: storageRootInput,
    });
  });

  it('writes camelCase YAML with storageRoot', async () => {
    const storageRoot = path.join(homeDir, 'projects');

    await initRenkuConfig(storageRoot, { homeDir });

    const configYaml = await fs.readFile(resolveRenkuConfigPath({ homeDir }), 'utf8');
    expect(configYaml).toContain('version: 0.1.0');
    expect(configYaml).toContain(`storageRoot: ${storageRoot}`);
    expect(configYaml).not.toContain('storage_root');
  });

  it('reads existing config', async () => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      `version: 0.1.0\nstorageRoot: ${path.join(homeDir, 'library')}\n`,
      'utf8'
    );

    await expect(readRenkuConfig({ homeDir })).resolves.toEqual({
      version: '0.1.0',
      storageRoot: path.join(homeDir, 'library'),
    });
    await expect(resolveRenkuStorageRoot({ homeDir })).resolves.toBe(
      path.join(homeDir, 'library')
    );
  });

  it('reports existing config without rewriting it', async () => {
    const firstStorageRoot = path.join(homeDir, 'first');
    const secondStorageRoot = path.join(homeDir, 'second');
    await initRenkuConfig(firstStorageRoot, { homeDir });
    const configPath = resolveRenkuConfigPath({ homeDir });
    const before = await fs.readFile(configPath, 'utf8');

    const result = await initRenkuConfig(secondStorageRoot, { homeDir });
    const after = await fs.readFile(configPath, 'utf8');

    expect(result.status).toBe('existing');
    expect(result.storageRoot).toBe(firstStorageRoot);
    expect(after).toBe(before);
  });

  it('fails when config is missing', async () => {
    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG002',
    });
  });

  it('fails when storageRoot is missing', async () => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, 'version: 0.1.0\n', 'utf8');

    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG007',
    });
  });

  it('fails when storageRoot is not a string', async () => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, 'version: 0.1.0\nstorageRoot: 123\n', 'utf8');

    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG007',
    });
  });

  it('rejects non-camelCase keys in config', async () => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      `version: 0.1.0\nstorage_root: ${path.join(homeDir, 'movies')}\n`,
      'utf8'
    );

    await expect(readRenkuConfig({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG005',
    });
  });

  it('fails when the storage root path conflicts with an existing file', async () => {
    const storageRoot = path.join(homeDir, 'not-a-directory');
    await fs.writeFile(storageRoot, 'file', 'utf8');

    await expect(initRenkuConfig(storageRoot, { homeDir })).rejects.toBeInstanceOf(
      RenkuConfigError
    );
    await expect(initRenkuConfig(storageRoot, { homeDir })).rejects.toMatchObject({
      code: 'CONFIG008',
    });
  });
});
