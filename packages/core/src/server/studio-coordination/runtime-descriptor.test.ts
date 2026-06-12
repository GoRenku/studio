import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STUDIO_DEV_SERVER_HOST,
  STUDIO_DEV_SERVER_PORT,
  STUDIO_DEV_SERVER_URL,
  STUDIO_RUNTIME_STALE_AFTER_MS,
  claimStudioRuntimeDescriptor,
  heartbeatStudioRuntimeDescriptor,
  isStudioRuntimeDescriptorProcessAlive,
  isStudioRuntimeDescriptorStale,
  isStudioRuntimeDescriptorUsable,
  readStudioRuntimeDescriptor,
  resolveStudioRuntimeDescriptorPath,
} from './runtime-descriptor.js';

describe('Studio runtime descriptor', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-runtime-'));
  });

  it('writes a CLI notification token with user-only permissions', async () => {
    const descriptor = await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      cliNotificationToken: 'notification-token-test',
    });

    expect(descriptor.cliNotificationToken).toBe('notification-token-test');
    await expect(readStudioRuntimeDescriptor({ homeDir })).resolves.toMatchObject({
      cliNotificationToken: 'notification-token-test',
    });
    const stat = await fs.stat(resolveStudioRuntimeDescriptorPath({ homeDir }));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('replaces a stale permissive descriptor with a user-only token descriptor', async () => {
    const descriptorPath = resolveStudioRuntimeDescriptorPath({ homeDir });
    await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
    await fs.writeFile(
      descriptorPath,
      JSON.stringify(
        {
          version: '0.1.0',
          serverInstanceId: 'studio_server_stale',
          pid: 123,
          host: '127.0.0.1',
          port: 5173,
          serverUrl: 'http://127.0.0.1:5173',
          startedAt: '2026-06-11T10:00:00.000Z',
          heartbeatAt: '2026-06-11T10:00:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );
    await fs.chmod(descriptorPath, 0o644);
    expect((await fs.stat(descriptorPath)).mode & 0o777).toBe(0o644);

    const descriptor = await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5174,
      serverUrl: 'http://127.0.0.1:5174',
      cliNotificationToken: 'notification-token-test',
      now: new Date('2026-06-11T10:02:00.001Z'),
    });

    expect(descriptor.cliNotificationToken).toBe('notification-token-test');
    await expect(readStudioRuntimeDescriptor({ homeDir })).resolves.toMatchObject({
      serverInstanceId: descriptor.serverInstanceId,
      cliNotificationToken: 'notification-token-test',
    });
    const stat = await fs.stat(descriptorPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('preserves the CLI notification token during heartbeat writes', async () => {
    const descriptor = await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      cliNotificationToken: 'notification-token-test',
      now: new Date('2026-06-11T10:00:00.000Z'),
    });

    const updated = await heartbeatStudioRuntimeDescriptor(descriptor, {
      homeDir,
    });

    expect(updated.cliNotificationToken).toBe('notification-token-test');
    await expect(readStudioRuntimeDescriptor({ homeDir })).resolves.toMatchObject({
      cliNotificationToken: 'notification-token-test',
    });
  });

  it('lets the canonical dev server replace a fresh non-canonical descriptor', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5174,
      serverUrl: 'http://127.0.0.1:5174',
      cliNotificationToken: 'old-notification-token',
    });

    const descriptor = await claimStudioRuntimeDescriptor({
      homeDir,
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: 'notification-token-test',
      replaceNonCanonicalDevServer: true,
    });

    expect(descriptor).toMatchObject({
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: 'notification-token-test',
    });
    await expect(readStudioRuntimeDescriptor({ homeDir })).resolves.toMatchObject({
      serverInstanceId: descriptor.serverInstanceId,
      serverUrl: STUDIO_DEV_SERVER_URL,
    });
  });

  it('does not let a second canonical dev server replace a fresh canonical descriptor', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: 'first-token',
    });

    await expect(
      claimStudioRuntimeDescriptor({
        homeDir,
        host: STUDIO_DEV_SERVER_HOST,
        port: STUDIO_DEV_SERVER_PORT,
        serverUrl: STUDIO_DEV_SERVER_URL,
        cliNotificationToken: 'second-token',
        replaceNonCanonicalDevServer: true,
      })
    ).rejects.toMatchObject({
      code: 'STUDIO_COORDINATION030',
    });
  });

  it('lets the canonical dev server replace a fresh descriptor whose process is gone', async () => {
    const descriptorPath = resolveStudioRuntimeDescriptorPath({ homeDir });
    const now = new Date();
    await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
    await fs.writeFile(
      descriptorPath,
      JSON.stringify(
        {
          version: '0.1.0',
          serverInstanceId: 'studio_server_dead_process',
          pid: 0,
          host: STUDIO_DEV_SERVER_HOST,
          port: STUDIO_DEV_SERVER_PORT,
          serverUrl: STUDIO_DEV_SERVER_URL,
          startedAt: now.toISOString(),
          heartbeatAt: now.toISOString(),
          cliNotificationToken: 'old-notification-token',
        },
        null,
        2
      ),
      'utf8'
    );

    const descriptor = await claimStudioRuntimeDescriptor({
      homeDir,
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: 'notification-token-test',
      replaceNonCanonicalDevServer: true,
    });

    expect(descriptor).toMatchObject({
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      cliNotificationToken: 'notification-token-test',
    });
    await expect(readStudioRuntimeDescriptor({ homeDir })).resolves.toMatchObject({
      serverInstanceId: descriptor.serverInstanceId,
      cliNotificationToken: 'notification-token-test',
    });
  });

  it('reads older descriptors without a CLI notification token', async () => {
    const descriptorPath = resolveStudioRuntimeDescriptorPath({ homeDir });
    await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
    await fs.writeFile(
      descriptorPath,
      JSON.stringify(
        {
          version: '0.1.0',
          serverInstanceId: 'studio_server_legacy',
          pid: 123,
          host: '127.0.0.1',
          port: 5173,
          serverUrl: 'http://127.0.0.1:5173',
          startedAt: '2026-06-11T10:00:00.000Z',
          heartbeatAt: '2026-06-11T10:00:00.000Z',
        },
        null,
        2
      ),
      'utf8'
    );

    const descriptor = await readStudioRuntimeDescriptor({ homeDir });

    expect(descriptor).toMatchObject({
      serverInstanceId: 'studio_server_legacy',
    });
    expect(descriptor?.cliNotificationToken).toBeUndefined();
  });

  it('keeps stale descriptor detection based on heartbeat age', () => {
    const heartbeatAt = new Date('2026-06-11T10:00:00.000Z');
    const descriptor = {
      version: '0.1.0' as const,
      serverInstanceId: 'studio_server_test',
      pid: 123,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      startedAt: heartbeatAt.toISOString(),
      heartbeatAt: heartbeatAt.toISOString(),
      cliNotificationToken: 'notification-token-test',
    };

    expect(
      isStudioRuntimeDescriptorStale(
        descriptor,
        new Date(heartbeatAt.getTime() + STUDIO_RUNTIME_STALE_AFTER_MS)
      )
    ).toBe(false);
    expect(
      isStudioRuntimeDescriptorStale(
        descriptor,
        new Date(heartbeatAt.getTime() + STUDIO_RUNTIME_STALE_AFTER_MS + 1)
      )
    ).toBe(true);
  });

  it('treats a fresh descriptor as usable only when its process is alive', () => {
    const now = new Date();
    const descriptor = {
      version: '0.1.0' as const,
      serverInstanceId: 'studio_server_test',
      pid: process.pid,
      host: STUDIO_DEV_SERVER_HOST,
      port: STUDIO_DEV_SERVER_PORT,
      serverUrl: STUDIO_DEV_SERVER_URL,
      startedAt: now.toISOString(),
      heartbeatAt: now.toISOString(),
      cliNotificationToken: 'notification-token-test',
    };

    expect(isStudioRuntimeDescriptorProcessAlive(descriptor)).toBe(true);
    expect(isStudioRuntimeDescriptorUsable(descriptor, now)).toBe(true);
    expect(
      isStudioRuntimeDescriptorProcessAlive({
        ...descriptor,
        pid: 0,
      })
    ).toBe(false);
    expect(
      isStudioRuntimeDescriptorUsable(
        {
          ...descriptor,
          pid: 0,
        },
        now
      )
    ).toBe(false);
  });
});
