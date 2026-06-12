import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  type ClaimStudioRuntimeDescriptorInput,
} from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendStudioDevServerLog,
  claimRequiredStudioDevRuntime,
} from './studio-dev-server.js';
import viteConfig from '../vite.config.js';

describe('Studio dev server runtime', () => {
  let tempDir: string;
  let logPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-dev-'));
    logPath = path.join(tempDir, 'studio-dev-server.log');
  });

  it('uses localhost 5173 as the canonical development server', async () => {
    const closeServer = vi.fn(async () => undefined);
    const claimRuntimeDescriptor = vi.fn(
      async (input: ClaimStudioRuntimeDescriptorInput) => ({
        version: '0.1.0' as const,
        serverInstanceId: 'studio_server_test',
        pid: 123,
        host: input.host,
        port: input.port,
        serverUrl: input.serverUrl,
        startedAt: '2026-06-12T09:00:00.000Z',
        heartbeatAt: '2026-06-12T09:00:00.000Z',
        cliNotificationToken: input.cliNotificationToken,
      })
    );

    const descriptor = await claimRequiredStudioDevRuntime({
      port: STUDIO_DEV_SERVER_PORT,
      cliNotificationToken: 'notification-token-test',
      claimRuntimeDescriptor,
      closeServer,
      logPath,
    });

    expect(descriptor).toMatchObject({
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
    });
    expect(claimRuntimeDescriptor).toHaveBeenCalledWith({
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: 'notification-token-test',
      replaceNonCanonicalDevServer: true,
    });
    expect(closeServer).not.toHaveBeenCalled();
  });

  it('configures Vite to use the canonical dev server address', async () => {
    const config =
      typeof viteConfig === 'function'
        ? await viteConfig({ command: 'serve', mode: 'development' })
        : viteConfig;

    expect(config.server).toMatchObject({
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      strictPort: true,
    });
  });

  it('closes the dev server when the runtime descriptor cannot be claimed', async () => {
    const closeServer = vi.fn(async () => undefined);
    const claimRuntimeDescriptor = vi.fn(async () => {
      throw new Error('Renku Studio is already running at http://localhost:5173.');
    });

    await expect(
      claimRequiredStudioDevRuntime({
        port: STUDIO_DEV_SERVER_PORT,
        cliNotificationToken: 'notification-token-test',
        claimRuntimeDescriptor,
        closeServer,
        logPath,
      })
    ).rejects.toThrow('Renku Studio is already running');

    expect(closeServer).toHaveBeenCalledTimes(1);
    await expect(fs.readFile(logPath, 'utf8')).resolves.toContain(
      'failed to claim runtime descriptor'
    );
  });

  it('closes the dev server when Vite is not on the canonical port', async () => {
    const closeServer = vi.fn(async () => undefined);
    const claimRuntimeDescriptor = vi.fn();

    await expect(
      claimRequiredStudioDevRuntime({
        port: STUDIO_DEV_SERVER_PORT + 1,
        cliNotificationToken: 'notification-token-test',
        claimRuntimeDescriptor,
        closeServer,
        logPath,
      })
    ).rejects.toThrow(STUDIO_DEV_SERVER_URL);

    expect(claimRuntimeDescriptor).not.toHaveBeenCalled();
    expect(closeServer).toHaveBeenCalledTimes(1);
  });

  it('writes compact lifecycle logs without runtime API tokens', async () => {
    await appendStudioDevServerLog('listening Studio dev server pid=123', {
      logPath,
    });

    const contents = await fs.readFile(logPath, 'utf8');
    expect(contents).toContain('listening Studio dev server pid=123');
    expect(contents).not.toContain('studioApiToken');
  });
});
