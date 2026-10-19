import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readInstalledRenkuRelease } from './installed-release.js';

function installed() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-installed-release-'));
  const executable = path.join(root, 'runtime/node/bin/node');
  mkdirSync(path.dirname(executable), { recursive: true });
  mkdirSync(path.join(root, 'distribution'));
  writeFileSync(path.join(root, 'distribution/install.sh'), '');
  writeFileSync(path.join(root, 'INSTALLATION.json'), JSON.stringify({ installRoot: root, binRoot: root }));
  writeFileSync(path.join(root, 'RELEASE.json'), JSON.stringify({ product: 'renku', version: '0.1.35', target: 'darwin-arm64' }));
  return { root, executable };
}

describe('readInstalledRenkuRelease', () => {
  it('reads the installed version and target', () => {
    const { executable } = installed();
    expect(readInstalledRenkuRelease({ executable, platform: 'darwin' })).toEqual({ version: '0.1.35', target: 'darwin-arm64' });
  });

  it('returns null for a source checkout and on Linux', () => {
    expect(readInstalledRenkuRelease({ executable: '/tmp/no-install/runtime/node/bin/node', platform: 'darwin' })).toBeNull();
    expect(readInstalledRenkuRelease({ executable: installed().executable, platform: 'linux' })).toBeNull();
  });

  it('reports missing or invalid release metadata of an installation', () => {
    const { root, executable } = installed();
    writeFileSync(path.join(root, 'RELEASE.json'), JSON.stringify({ product: 'renku', version: 'next', target: 'darwin-arm64' }));
    expect(() => readInstalledRenkuRelease({ executable, platform: 'darwin' })).toThrowError(expect.objectContaining({ code: 'UPDATE005' }));
    rmSync(path.join(root, 'RELEASE.json'));
    expect(() => readInstalledRenkuRelease({ executable, platform: 'darwin' })).toThrowError(expect.objectContaining({ code: 'UPDATE005' }));
  });
});
