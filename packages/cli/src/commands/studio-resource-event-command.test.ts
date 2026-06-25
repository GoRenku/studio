import fs from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  claimStudioRuntimeDescriptor,
  createStudioCoordinationService,
  initRenkuConfig,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';
import type { CliCommandRuntime } from './structured-command.js';

describe('Studio resource event command', () => {
  let homeDir: string;
  let storageRoot: string;
  let stdout: string[];
  let stderr: string[];
  const servers: Array<{ close: () => Promise<void> }> = [];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-resource-event-'));
    storageRoot = path.join(homeDir, 'movies');
    stdout = [];
    stderr = [];
    await initRenkuConfig(storageRoot, { homeDir });
  });

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  it('does not warn when no Studio runtime is running', async () => {
    await appendStudioResourceChangedEvent({
      runtime: runtimeFixture({ homeDir, stdout, stderr, json: false }),
      command: 'media import',
      report: {
        project: { name: 'constantinople', id: 'project_test0001' },
        resourceKeys: ['surface:story-arc'],
      },
    });

    expect(stdout).toEqual([]);
    expect(stderr).toEqual([]);
  });

  it('warns when a fresh Studio runtime cannot receive the notification', async () => {
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: 1,
      serverUrl: 'http://127.0.0.1:1',
      cliNotificationToken: 'notification-token-test',
    });

    await appendStudioResourceChangedEvent({
      runtime: runtimeFixture({ homeDir, stdout, stderr, json: true }),
      command: 'media import',
      report: {
        project: { name: 'constantinople', id: 'project_test0001' },
        resourceKeys: ['surface:story-arc'],
      },
    });

    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join('\n'))).toMatchObject({
      warnings: [
        {
          code: 'CLI026',
          message:
            'Project mutation succeeded, but the running Studio app could not be notified.',
          detail: expect.stringContaining('http://127.0.0.1:1'),
          suggestion: expect.stringContaining('local network access'),
        },
      ],
    });
  });

  it('delivers Lookbook sheet resource changes through the running Studio server', async () => {
    const coordination = createStudioCoordinationService({ homeDir });
    const server = await startCoordinationNotificationServer({
      homeDir,
      token: 'notification-token-test',
    });
    servers.push(server);
    await claimStudioRuntimeDescriptor({
      homeDir,
      host: '127.0.0.1',
      port: server.port,
      serverUrl: server.url,
      cliNotificationToken: 'notification-token-test',
    });

    await appendStudioResourceChangedEvent({
      runtime: runtimeFixture({ homeDir, stdout, stderr, json: false }),
      command: 'media import',
      report: {
        project: { name: 'constantinople', id: 'project_test0001' },
        resourceKeys: [
          'surface:visual-language:lookbook:lookbook_test0001',
        ],
      },
    });

    expect(stderr).toEqual([]);
    await expect(coordination.readStudioEvents()).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          type: 'studio.projectResourcesChanged',
          projectRef: {
            name: 'constantinople',
            id: 'project_test0001',
            storageRoot,
          },
          resourceKeys: [
            'surface:visual-language:lookbook:lookbook_test0001',
          ],
          source: { kind: 'cli', command: 'media import' },
        }),
      ],
    });
  });
});

function runtimeFixture(input: {
  homeDir: string;
  stdout: string[];
  stderr: string[];
  json: boolean;
}): CliCommandRuntime {
  return {
    homeDir: input.homeDir,
    json: input.json,
    io: {
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
    },
    projectDataService: {} as ProjectDataService,
  };
}

async function startCoordinationNotificationServer(input: {
  homeDir: string;
  token: string;
}): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const coordination = createStudioCoordinationService({ homeDir: input.homeDir });
  const server = createServer(async (request, response) => {
    if (
      request.method !== 'POST' ||
      request.url !== '/studio-api/studio/events/project-resources-changed' ||
      request.headers['x-renku-studio-notification-token'] !== input.token
    ) {
      response.statusCode = 403;
      response.end(JSON.stringify({ error: { code: 'STUDIO_SERVER022' } }));
      return;
    }

    const body = JSON.parse(await readRequestBody(request)) as {
      projectRef: {
        name: string;
        id: string;
        storageRoot: string;
      };
      resourceKeys: string[];
      source: { kind: 'cli'; command: string };
      operationId?: string;
    };
    const event = await coordination.appendStudioEvent({
      type: 'studio.projectResourcesChanged',
      projectRef: body.projectRef,
      resourceKeys: body.resourceKeys,
      source: body.source,
      operationId: body.operationId,
    });
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ event }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine notification server address.');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
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
