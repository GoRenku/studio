import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runGenerationCommand } from '../command.js';
import { runRenkuCli } from '../../../cli.js';

let homeDir: string;
beforeEach(async () => { homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'model-cli-'))); });
afterEach(async () => { await fs.rm(homeDir, { recursive: true, force: true }); });

it('imports, lists, shows and removes personal routes without Project setup or credentials', async () => {
  const log = vi.fn();
  const io = { stdout: { log }, stderr: { error: vi.fn() } };
  const run = async (input: string[], flags = {}) => {
    await runGenerationCommand({ input: ['models', ...input], flags, json: true, io, homeDir });
    return JSON.parse(log.mock.calls.at(-1)![0]);
  };
  const file = path.join(homeDir, 'route.json');
  await fs.writeFile(file, JSON.stringify({ provider: 'fal-ai', apiId: 'fixture/unindexed', name: 'New model' }));
  const imported = await run(['import'], { file, ifRevision: 'absent' });
  expect(imported.provider).toBe('fal-ai');
  expect(imported.revision).toMatch(/^[a-f0-9]{64}$/);
  const listed = await run(['list']);
  expect(listed.routes).toHaveLength(1);
  expect((await run(['list'], { query: 'NEW model' })).routes).toHaveLength(1);
  expect((await run(['list'], { query: 'absent' })).routes).toEqual([]);
  expect(await runRenkuCli(['generation', 'models', 'list', '--query', 'absent', '--json'], { homeDir, io })).toBe(0);
  expect(JSON.parse(log.mock.calls.at(-1)![0]).routes).toEqual([]);
  const identity = { provider: 'fal-ai', model: 'fixture/unindexed' };
  expect((await run(['show'], identity)).route.name).toBe('New model');
  await expect(run(['remove'], identity)).rejects.toMatchObject({ code: 'CLI001' });
  await run(['remove'], { ...identity, ifRevision: imported.revision });
  expect((await run(['list'])).routes).toEqual([]);
});
