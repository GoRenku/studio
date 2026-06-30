import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createProjectDataService,
  initRenkuConfig,
} from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runStudioCommand } from './studio-command.js';
import { notifyStudioProjectResourcesChanged } from './studio-notification-client.js';

vi.mock('./studio-notification-client.js', () => ({
  notifyStudioProjectResourcesChanged: vi.fn(),
}));

describe('studio command', () => {
  let homeDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-command-'));
    await initRenkuConfig(path.join(homeDir, 'movies'), { homeDir });
    stdout = [];
    stderr = [];
    vi.mocked(notifyStudioProjectResourcesChanged).mockReset();
    vi.mocked(notifyStudioProjectResourcesChanged).mockResolvedValue({
      status: 'notRunning',
    });
  });

  it('runs notify-refresh with the resolved durable project identity id', async () => {
    const projectData = createProjectDataService();
    await projectData.createMovieProject({
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      homeDir,
    });
    const project = await projectData.readProjectShell({
      projectName: 'constantinople',
      homeDir,
    });

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
      project: {
        name: 'constantinople',
        id: project.identity.id,
      },
      resourceKeys: ['scene-shot-video-take:take_test0001'],
    });
    expect(notifyStudioProjectResourcesChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        homeDir,
        notification: expect.objectContaining({
          projectRef: expect.objectContaining({
            name: 'constantinople',
            id: project.identity.id,
          }),
          resourceKeys: ['scene-shot-video-take:take_test0001'],
        }),
      })
    );
    expect(project.identity.id).toMatch(/^project_/);
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

  it('fails fast when notify-refresh cannot resolve the requested project', async () => {
    await expect(
      runStudioCommand({
        input: ['notify-refresh'],
        project: 'missing-project',
        resource: ['media'],
        json: true,
        io: ioFixture({ stdout, stderr }),
        homeDir,
      }),
    ).rejects.toMatchObject({
      code: expect.any(String),
    });

    expect(notifyStudioProjectResourcesChanged).not.toHaveBeenCalled();
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
