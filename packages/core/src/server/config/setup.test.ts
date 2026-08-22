import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { initRenkuConfig } from './document.js';
import { resolveRenkuConfigPath } from './paths.js';
import { initializeRenkuSetup, readRenkuSetup } from './setup.js';

describe('Renku first-run setup', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-setup-test-'));
  });

  it('reports setup required without creating files', async () => {
    await expect(readRenkuSetup({ homeDir })).resolves.toEqual({
      status: 'setupRequired',
      recommendedStorageRoot: path.join(homeDir, 'Movies', 'Renku'),
    });
    await expect(fs.stat(path.join(homeDir, '.config'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('creates the recommended Project Library and config', async () => {
    const result = await initializeRenkuSetup({ homeDir });
    const storageRoot = path.join(homeDir, 'Movies', 'Renku');

    expect(result).toEqual({
      status: 'created',
      setup: { status: 'configured', storageRoot },
    });
    await expect(fs.stat(storageRoot)).resolves.toHaveProperty('isDirectory');
    await expect(readRenkuSetup({ homeDir })).resolves.toEqual({
      status: 'configured',
      storageRoot,
    });
  });

  it('preserves an existing custom config', async () => {
    const storageRoot = path.join(homeDir, 'custom-library');
    await initRenkuConfig(storageRoot, { homeDir });
    const before = await fs.readFile(resolveRenkuConfigPath({ homeDir }), 'utf8');

    await expect(initializeRenkuSetup({ homeDir })).resolves.toEqual({
      status: 'existing',
      setup: { status: 'configured', storageRoot },
    });
    await expect(fs.readFile(resolveRenkuConfigPath({ homeDir }), 'utf8')).resolves.toBe(
      before
    );
  });

  it('does not overwrite an invalid existing config', async () => {
    const configPath = resolveRenkuConfigPath({ homeDir });
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, 'version: nope\n', 'utf8');

    await expect(initializeRenkuSetup({ homeDir })).rejects.toMatchObject({
      code: 'CONFIG006',
    });
    await expect(fs.readFile(configPath, 'utf8')).resolves.toBe('version: nope\n');
  });

  it('reports a structured failure before persisting config when the recommendation cannot be created', async () => {
    const blockedHome = path.join(homeDir, 'blocked-home');
    const configPath = path.join(homeDir, 'config.yaml');
    await fs.writeFile(blockedHome, 'not a directory', 'utf8');

    await expect(
      initializeRenkuSetup({ homeDir: blockedHome, configPath })
    ).rejects.toMatchObject({
      code: 'CONFIG015',
      issues: [{ code: 'CONFIG015' }],
    });
    await expect(fs.stat(configPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
