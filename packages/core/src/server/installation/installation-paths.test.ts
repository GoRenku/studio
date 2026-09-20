import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readRenkuInstallation } from './installation-paths.js';

it.each(['darwin', 'win32'] as const)('reads installed %s paths, including spaces and Unicode', (platform) => {
  const product = mkdtempSync(path.join(os.tmpdir(), 'renku-update-'));
  const installRoot = path.join(product, 'Renku é');
  const binRoot = path.join(product, 'my launchers');
  mkdirSync(path.join(product, 'distribution'));
  writeFileSync(path.join(product, 'distribution', platform === 'win32' ? 'install.ps1' : 'install.sh'), '');
  writeFileSync(path.join(product, 'INSTALLATION.json'), JSON.stringify({ installRoot, binRoot }));
  const executable = path.join(product, 'runtime', 'node', platform === 'win32' ? 'node.exe' : 'bin/node');
  expect(readRenkuInstallation(executable, platform)).toMatchObject({ productRoot: product, installRoot, binRoot });
});

it('rejects a development checkout or missing installation metadata', () => {
  expect(() => readRenkuInstallation('/not-installed/bin/node', 'darwin')).toThrow(expect.objectContaining({ code: 'UPDATE001' }));
});
