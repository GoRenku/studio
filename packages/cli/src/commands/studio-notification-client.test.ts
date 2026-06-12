import fs from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  STUDIO_RUNTIME_STALE_AFTER_MS,
  claimStudioRuntimeDescriptor,
  resolveStudioEventStorePath,
  resolveStudioRuntimeDescriptorPath,
} from '@gorenku/studio-core/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  notifyStudioProjectResourcesChanged,
  type StudioProjectResourcesChangedNotification,
} from './studio-notification-client.js';

describe('Studio notification client', () => {
  let homeDir: string;
  const servers: Array<{ close: () => Promise<void> }> = [];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-notify-'));
  });

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('returns notRunning when the Studio runtime descriptor is missing', async () => {
    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
      })
    ).resolves.toEqual({ status: 'notRunning' });
  });

  it('returns notRunning when the Studio runtime descriptor is stale', async () => {
    const heartbeatAt = new Date('2026-06-11T10:00:00.000Z');
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 5173,
      serverUrl: 'http://127.0.0.1:5173',
      now: heartbeatAt,
    });

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
        now: new Date(heartbeatAt.getTime() + STUDIO_RUNTIME_STALE_AFTER_MS + 1),
      })
    ).resolves.toEqual({ status: 'notRunning' });
  });

  it('returns notRunning when the Studio runtime descriptor process is gone', async () => {
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
          host: '127.0.0.1',
          port: 5173,
          serverUrl: 'http://127.0.0.1:5173',
          startedAt: now.toISOString(),
          heartbeatAt: now.toISOString(),
          cliNotificationToken: 'notification-token-test',
        },
        null,
        2
      ),
      'utf8'
    );

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
      })
    ).resolves.toEqual({ status: 'notRunning' });
  });

  it('returns notConfigured when a fresh legacy descriptor has no notification token', async () => {
    const descriptorPath = resolveStudioRuntimeDescriptorPath({ homeDir });
    await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
    await fs.writeFile(
      descriptorPath,
      JSON.stringify(
        {
          version: '0.1.0',
          serverInstanceId: 'studio_server_legacy',
          pid: process.pid,
          host: '127.0.0.1',
          port: 5173,
          serverUrl: 'http://127.0.0.1:5173',
          startedAt: new Date().toISOString(),
          heartbeatAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
      })
    ).resolves.toEqual({ status: 'notConfigured' });
  });

  it('posts project resource notifications to the running Studio server', async () => {
    const received: Array<{ headers: IncomingMessage['headers']; body: unknown }> = [];
    const server = await startNotificationServer(async (request) => {
      received.push({
        headers: request.headers,
        body: JSON.parse(await readRequestBody(request)),
      });
      return { status: 200, body: JSON.stringify({ event: { id: 'studio_event_test' } }) };
    });
    servers.push(server);
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: server.port,
      serverUrl: server.url,
      cliNotificationToken: 'notification-token-test',
    });

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
      })
    ).resolves.toEqual({ status: 'delivered' });

    expect(received).toEqual([
      {
        headers: expect.objectContaining({
          'x-renku-studio-notification-token': 'notification-token-test',
        }),
        body: notificationFixture(),
      },
    ]);
    await expect(
      fs.access(resolveStudioEventStorePath({ homeDir }))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports deliveryFailed for server rejection', async () => {
    const server = await startNotificationServer(async () => ({
      status: 403,
      body: JSON.stringify({ error: { code: 'STUDIO_SERVER022' } }),
    }));
    servers.push(server);
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: server.port,
      serverUrl: server.url,
      cliNotificationToken: 'notification-token-test',
    });

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
      })
    ).resolves.toMatchObject({
      status: 'deliveryFailed',
      serverUrl: server.url,
      detail: expect.stringContaining('HTTP 403'),
    });
  });

  it('reports deliveryFailed for network failures to a fresh runtime descriptor', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 1,
      serverUrl: 'http://127.0.0.1:1',
      cliNotificationToken: 'notification-token-test',
    });

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
      })
    ).resolves.toMatchObject({
      status: 'deliveryFailed',
      serverUrl: 'http://127.0.0.1:1',
    });
  });

  it('reports deliveryFailed when the Studio server accepts a request but never answers', async () => {
    const server = await startNotificationServer(
      async () => new Promise<never>(() => undefined)
    );
    servers.push(server);
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: server.port,
      serverUrl: server.url,
      cliNotificationToken: 'notification-token-test',
    });

    await expect(
      notifyStudioProjectResourcesChanged({
        homeDir,
        notification: notificationFixture(),
        requestTimeoutMs: 20,
      })
    ).resolves.toEqual({
      status: 'deliveryFailed',
      serverUrl: server.url,
      detail: 'Studio notification request timed out after 20ms.',
    });
  });
});

function notificationFixture(): StudioProjectResourcesChangedNotification {
  return {
    projectRef: {
      name: 'constantinople',
      id: 'project_test0001',
      storageRoot: '/tmp/renku',
    },
    resourceKeys: ['surface:story-arc'],
    source: { kind: 'cli', command: 'screenplay analyze write' },
    operationId: 'studio_operation_test',
  };
}

async function startNotificationServer(
  handler: (
    request: IncomingMessage
  ) => Promise<{ status: number; body: string }>
): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const result = await handler(request);
    response.statusCode = result.status;
    response.setHeader('Content-Type', 'application/json');
    response.end(result.body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine test server address.');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
