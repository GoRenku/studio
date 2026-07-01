import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProviderEnvFiles } from './provider-env-files.js';

const ENV_KEYS = ['FAL_KEY', 'REPLICATE_API_TOKEN'] as const;
const originalValues = new Map<string, string | undefined>();

describe('loadProviderEnvFiles', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = originalValues.get(key);
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    originalValues.clear();
  });

  it('loads provider API keys only from the Renku config .env', async () => {
    rememberEnv('FAL_KEY');
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-provider-env-')
    );
    const repoRoot = path.join(tempRoot, 'studio');
    const homeDir = path.join(tempRoot, 'home');
    const renkuConfigDir = path.join(homeDir, '.config', 'renku');
    await fs.mkdir(repoRoot, { recursive: true });
    await fs.mkdir(renkuConfigDir, { recursive: true });
    await fs.writeFile(
      path.join(repoRoot, '.env'),
      [
        '# Provider credentials',
        'FAL_KEY="fal-key-from-repo-env"',
      ].join('\n'),
      'utf8'
    );
    await fs.writeFile(
      path.join(renkuConfigDir, '.env'),
      'FAL_KEY=fal-key-from-renku-config\n',
      'utf8'
    );

    const originalCwd = process.cwd();
    process.chdir(repoRoot);
    try {
      const result = loadProviderEnvFiles({
        homeDir,
      });

      expect(result.loaded).toEqual([path.join(renkuConfigDir, '.env')]);
      expect(result.skipped).toEqual([]);
      expect(process.env.FAL_KEY).toBe('fal-key-from-renku-config');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('keeps explicitly exported environment variables ahead of .env values', async () => {
    rememberEnv('FAL_KEY');
    process.env.FAL_KEY = 'exported-fal-key';
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-provider-env-'));
    await fs.writeFile(path.join(root, '.env'), 'FAL_KEY=file-fal-key\n', 'utf8');

    loadProviderEnvFiles({
      renkuConfigDir: root,
    });

    expect(process.env.FAL_KEY).toBe('exported-fal-key');
  });

  it('skips an unreadable Renku config .env without falling back to the repo', async () => {
    rememberEnv('FAL_KEY');
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-provider-env-')
    );
    const repoRoot = path.join(tempRoot, 'studio');
    const renkuConfigDir = path.join(tempRoot, 'home', '.config', 'renku');
    const deniedRenkuEnv = path.join(renkuConfigDir, '.env');
    await fs.mkdir(repoRoot, { recursive: true });
    await fs.mkdir(renkuConfigDir, { recursive: true });
    await fs.writeFile(
      path.join(repoRoot, '.env'),
      'FAL_KEY=fal-key-from-repo-env\n',
      'utf8'
    );
    await fs.writeFile(
      deniedRenkuEnv,
      'FAL_KEY=fal-key-from-renku-config\n',
      'utf8'
    );
    await fs.chmod(deniedRenkuEnv, 0o000);

    const originalCwd = process.cwd();
    process.chdir(repoRoot);
    try {
      const result = loadProviderEnvFiles({
        renkuConfigDir,
      });

      expect(result.loaded).toEqual([]);
      expect(result.skipped).toEqual([deniedRenkuEnv]);
      expect(process.env.FAL_KEY).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
      await fs.chmod(deniedRenkuEnv, 0o600);
    }
  });

  it('ignores .env.local in the Renku config directory', async () => {
    rememberEnv('REPLICATE_API_TOKEN');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-provider-env-'));
    const renkuConfigDir = path.join(root, 'home', '.config', 'renku');
    await fs.mkdir(renkuConfigDir, { recursive: true });
    await fs.writeFile(
      path.join(renkuConfigDir, '.env'),
      'REPLICATE_API_TOKEN=replicate-from-env\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(renkuConfigDir, '.env.local'),
      'REPLICATE_API_TOKEN=replicate-from-env-local\n',
      'utf8'
    );

    const result = loadProviderEnvFiles({
      renkuConfigDir,
    });

    expect(result.loaded).toEqual([path.join(renkuConfigDir, '.env')]);
    expect(result.skipped).toEqual([]);
    expect(process.env.REPLICATE_API_TOKEN).toBe('replicate-from-env');
  });
});

function rememberEnv(key: (typeof ENV_KEYS)[number]): void {
  if (!originalValues.has(key)) {
    originalValues.set(key, process.env[key]);
  }
  delete process.env[key];
}
