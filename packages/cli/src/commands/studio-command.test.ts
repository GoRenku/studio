import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initRenkuConfig } from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { runStudioCommand } from './studio-command.js';

describe('studio command', () => {
  let homeDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-command-'));
    await initRenkuConfig(path.join(homeDir, 'movies'), { homeDir });
    stdout = [];
    stderr = [];
  });

  it('runs notify-refresh as a focused non-mutating Studio notification command', async () => {
    await expect(
      runStudioCommand({
        input: ['notify-refresh'],
        project: 'constantinople',
        resource: ['scene-shot-video-take:take_test0001'],
        json: true,
        io: ioFixture({ stdout, stderr }),
        homeDir,
      }),
    ).resolves.toBe(0);

    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join('\n'))).toEqual({
      valid: true,
      project: { name: 'constantinople' },
      resourceKeys: ['scene-shot-video-take:take_test0001'],
    });
  });

  it('reports structured errors for missing notify-refresh resources', async () => {
    await expect(
      runStudioCommand({
        input: ['notify-refresh'],
        project: 'constantinople',
        resource: [],
        json: true,
        io: ioFixture({ stdout, stderr }),
        homeDir,
      }),
    ).rejects.toMatchObject({
      code: 'CLI143',
    });
  });
});

function ioFixture(input: { stdout: string[]; stderr: string[] }) {
  return {
    stdout: {
      log(message: string) {
        input.stdout.push(message);
      },
    },
    stderr: {
      error(message: string) {
        input.stderr.push(message);
      },
    },
  };
}
