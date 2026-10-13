import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runGenerationCommand } from './command.js';

let homeDir: string;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-default-models-cli-'));
});

afterEach(async () => {
  await fs.rm(homeDir, { recursive: true, force: true });
});

it('syncs the Skill Default Model List without a Project and reports unchanged content', async () => {
  const file = path.join(homeDir, 'default-models.json');
  await fs.writeFile(file, JSON.stringify({
    formatVersion: 1,
    lanes: {
      image: [],
      imageEdit: [{ model: 'fictional-edit', name: 'Fictional Edit', providers: ['provider-one'], recommendedFor: ['provider-one'] }],
      video: [],
      audio: [],
    },
  }));
  const run = async () => {
    const log = vi.fn();
    await runGenerationCommand({
      input: ['default-models', 'sync'],
      flags: { file },
      json: true,
      io: { stdout: { log }, stderr: { error: vi.fn() } },
      homeDir,
    });
    return JSON.parse(log.mock.calls[0]![0]) as { changed: boolean; sha256: string; path: string };
  };

  const first = await run();
  expect(first).toEqual({
    changed: true,
    sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    path: path.join(homeDir, '.local', 'state', 'renku', 'default-models.json'),
  });
  expect(await run()).toEqual({ ...first, changed: false });
});
