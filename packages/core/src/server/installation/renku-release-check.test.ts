import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { checkRenkuUpdateWithOptions } from './renku-release-check.js';

function installed(version = '0.0.1') {
  const root = mkdtempSync(path.join(os.tmpdir(), 'renku-check-'));
  const executable = path.join(root, 'runtime/node/bin/node');
  mkdirSync(path.dirname(executable), { recursive: true });
  mkdirSync(path.join(root, 'distribution'));
  writeFileSync(path.join(root, 'distribution/install.sh'), '');
  writeFileSync(path.join(root, 'INSTALLATION.json'), JSON.stringify({ installRoot: root, binRoot: root }));
  writeFileSync(path.join(root, 'RELEASE.json'), JSON.stringify({ product: 'renku', version, target: 'darwin-arm64' }));
  return { root, executable };
}

function manifest(version: string) {
  return {
    product: 'renku', channel: 'beta', version,
    artifacts: [{ target: 'darwin-arm64', versionKey: `studio/releases/${version}/darwin-arm64/renku.tar.gz`, sha256: 'a'.repeat(64) }],
  };
}

describe('Renku release check', () => {
  it.each([
    ['0.0.2', 'available'],
    ['0.0.1', 'current'],
    ['0.0.0', 'current'],
  ] as const)('compares installed 0.0.1 with published %s', async (published, state) => {
    const { executable } = installed();
    const fetcher = vi.fn(async (_url: Parameters<typeof fetch>[0]) => Response.json(manifest(published)));
    await expect(checkRenkuUpdateWithOptions({ executable, platform: 'darwin', fetcher })).resolves.toEqual({
      state, installedVersion: '0.0.1', publishedVersion: published,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://downloads.gorenku.com/studio/channels/beta/release.json');
  });

  it('rejects a missing platform archive without downloading anything', async () => {
    const { executable } = installed();
    const fetcher = vi.fn(async () => Response.json({ ...manifest('0.0.2'), artifacts: [] }));
    await expect(checkRenkuUpdateWithOptions({ executable, platform: 'darwin', fetcher })).rejects.toMatchObject({ code: 'UPDATE007' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reports network failures and invalid installed metadata', async () => {
    const { root, executable } = installed();
    await expect(checkRenkuUpdateWithOptions({ executable, platform: 'darwin', fetcher: vi.fn(async () => { throw new Error('offline'); }) })).rejects.toMatchObject({ code: 'UPDATE006' });
    writeFileSync(path.join(root, 'RELEASE.json'), '{');
    await expect(checkRenkuUpdateWithOptions({ executable, platform: 'darwin' })).rejects.toMatchObject({ code: 'UPDATE005' });
    writeFileSync(path.join(root, 'RELEASE.json'), 'null');
    await expect(checkRenkuUpdateWithOptions({ executable, platform: 'darwin' })).rejects.toMatchObject({ code: 'UPDATE005' });
  });

  it('uses the configured loopback source and hides updates in a development checkout', async () => {
    const { executable } = installed();
    const fetcher = vi.fn(async (_url: Parameters<typeof fetch>[0]) => Response.json(manifest('0.0.2')));
    await checkRenkuUpdateWithOptions({ executable, platform: 'darwin', downloadBaseUrl: 'http://127.0.0.1:7777', fetcher });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('http://127.0.0.1:7777/');
    await expect(checkRenkuUpdateWithOptions({ executable: '/tmp/no-install/runtime/node/bin/node', platform: 'darwin' })).resolves.toEqual({ state: 'notInstalled' });
  });
});
