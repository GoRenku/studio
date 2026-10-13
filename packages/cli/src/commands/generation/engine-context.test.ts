import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createEngineContext } from './engine-context.js';

let homeDir: string;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-engine-context-'));
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(path.join(configDir, '.env'), 'FAL_KEY=test-key\n', 'utf8');
});

afterEach(async () => {
  await fs.rm(homeDir, { recursive: true, force: true });
});

it('writes provider metadata under the Renku state directory and never under config', async () => {
  const configBefore = await listFiles(path.join(homeDir, '.config'));
  const context = await createEngineContext({
    provider: 'fal-ai',
    homeDir,
    signal: new AbortController().signal,
  });

  await context.metadataCache.write(
    { provider: 'fal-ai', model: 'fictional/model', url: 'https://example.test/schema' },
    { body: { ok: true }, fetchedAt: '2026-10-12T00:00:00.000Z' },
  );

  expect(await listFiles(path.join(homeDir, '.config'))).toEqual(configBefore);
  const stateFiles = await listFiles(path.join(homeDir, '.local', 'state', 'renku'));
  expect(stateFiles).toHaveLength(1);
  expect(stateFiles[0]).toMatch(/^cache\/provider-metadata\/[0-9a-f]{64}\.json$/);
});

async function listFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}
