import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProviderEnvFiles } from './provider-env-files.js';

const ENV_KEYS = ['FAL_KEY', 'REPLICATE_API_TOKEN', 'OPENAI_API_KEY'] as const;
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

  it('loads provider API keys from stable Studio and Renku config roots', async () => {
    rememberEnv('FAL_KEY');
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-provider-env-')
    );
    const studioWorkspaceRoot = path.join(tempRoot, 'studio');
    const renkuConfigDir = path.join(tempRoot, 'home', '.config', 'renku');
    const unrelatedWorkingDir = path.join(tempRoot, 'somewhere-else');
    await fs.mkdir(studioWorkspaceRoot, { recursive: true });
    await fs.mkdir(renkuConfigDir, { recursive: true });
    await fs.mkdir(unrelatedWorkingDir, { recursive: true });
    await fs.writeFile(
      path.join(studioWorkspaceRoot, '.env'),
      [
        '# Provider credentials',
        'FAL_KEY="fal-key-from-studio-env"',
      ].join('\n'),
      'utf8'
    );
    await fs.writeFile(
      path.join(renkuConfigDir, '.env.local'),
      'FAL_KEY=fal-key-from-renku-config\n',
      'utf8'
    );

    const originalCwd = process.cwd();
    process.chdir(unrelatedWorkingDir);
    try {
      const result = loadProviderEnvFiles({
        studioWorkspaceRoot,
        renkuConfigDir,
      });

      expect(result.loaded).toEqual([
        path.join(renkuConfigDir, '.env.local'),
        path.join(studioWorkspaceRoot, '.env'),
      ]);
      expect(process.env.FAL_KEY).toBe('fal-key-from-studio-env');
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
      providerEnvRoots: [root],
    });

    expect(process.env.FAL_KEY).toBe('exported-fal-key');
  });

  it('lets later provider env roots override earlier provider env roots', async () => {
    rememberEnv('OPENAI_API_KEY');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-provider-env-'));
    const renkuConfigDir = path.join(root, 'home', '.config', 'renku');
    await fs.mkdir(renkuConfigDir, { recursive: true });
    await fs.writeFile(
      path.join(root, '.env'),
      'OPENAI_API_KEY=openai-from-root\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(renkuConfigDir, '.env'),
      'OPENAI_API_KEY=openai-from-renku-config\n',
      'utf8'
    );

    const result = loadProviderEnvFiles({
      providerEnvRoots: [root, renkuConfigDir],
    });

    expect(result.loaded).toEqual([
      path.join(root, '.env'),
      path.join(renkuConfigDir, '.env'),
    ]);
    expect(process.env.OPENAI_API_KEY).toBe('openai-from-renku-config');
  });

  it('lets .env.local override .env when both files live in the same directory', async () => {
    rememberEnv('REPLICATE_API_TOKEN');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-provider-env-'));
    await fs.writeFile(
      path.join(root, '.env'),
      'REPLICATE_API_TOKEN=replicate-from-env\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(root, '.env.local'),
      'REPLICATE_API_TOKEN=replicate-from-env-local\n',
      'utf8'
    );

    loadProviderEnvFiles({
      providerEnvRoots: [root],
    });

    expect(process.env.REPLICATE_API_TOKEN).toBe('replicate-from-env-local');
  });
});

function rememberEnv(key: (typeof ENV_KEYS)[number]): void {
  if (!originalValues.has(key)) {
    originalValues.set(key, process.env[key]);
  }
  delete process.env[key];
}
