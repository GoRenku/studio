import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveStudioRuntimeDescriptorPath } from '@gorenku/studio-core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runStudioStopCommand } from './stop-command.js';

describe('studio stop command', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports when no server is running', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-stop-'));
    const stdout: string[] = [];
    await expect(runStudioStopCommand(options(homeDir, stdout))).resolves.toBe(0);
    expect(stdout).toEqual(['Renku Studio is not running.']);
  });

  it('reports an absent server as JSON', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-stop-'));
    const stdout: string[] = [];
    await expect(runStudioStopCommand({ ...options(homeDir, stdout), json: true })).resolves.toBe(0);
    expect(JSON.parse(stdout[0])).toEqual({ stopped: false });
  });

  it('requests authenticated shutdown and waits for descriptor release', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-stop-'));
    const descriptorPath = await writeDescriptor(homeDir, 'http://localhost:5173');
    const stdout: string[] = [];
    const fetchMock = vi.fn(
      async (url: Parameters<typeof fetch>[0], request: Parameters<typeof fetch>[1]) => {
        expect(url.toString()).toBe('http://localhost:5173/studio-api/studio/shutdown');
        expect(request?.headers).toEqual({
          'X-Renku-Studio-Notification-Token': 'studio-token',
        });
        await fs.unlink(descriptorPath);
        return new Response(JSON.stringify({ stopping: true }), { status: 200 });
      }
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(runStudioStopCommand(options(homeDir, stdout))).resolves.toBe(0);
    expect(stdout).toEqual(['Renku Studio stopped.']);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports a rejected shutdown without claiming the server stopped', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-stop-'));
    await writeDescriptor(homeDir, 'http://localhost:5173');
    const stdout: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 403 })));

    await expect(runStudioStopCommand(options(homeDir, stdout))).rejects.toMatchObject({
      code: 'CLI165',
    });
    expect(stdout).toEqual([]);
  });

  it('does not contact a non-local URL in a descriptor', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-stop-'));
    await writeDescriptor(homeDir, 'http://example.com:5173');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(runStudioStopCommand(options(homeDir, []))).rejects.toMatchObject({
      code: 'CLI164',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function writeDescriptor(homeDir: string, serverUrl: string): Promise<string> {
  const descriptorPath = resolveStudioRuntimeDescriptorPath({ homeDir });
  await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
  await fs.writeFile(
    descriptorPath,
    JSON.stringify({
      version: '0.1.0',
      serverInstanceId: 'studio_server_stop_test',
      pid: process.pid,
      host: new URL(serverUrl).hostname,
      port: 5173,
      serverUrl,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      cliNotificationToken: 'studio-token',
    })
  );
  return descriptorPath;
}

function options(homeDir: string, stdout: string[]) {
  return {
    input: ['stop'],
    json: false,
    homeDir,
    io: {
      stdout: { log: (message: string) => stdout.push(message) },
      stderr: { error: () => undefined },
    },
  };
}
