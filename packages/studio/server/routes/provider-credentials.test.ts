import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import {
  createProviderCredentialsRoute,
  type ProviderCredentialsRouteService,
} from './provider-credentials.js';

describe('provider credentials Hono route', () => {
  it('protects reads and updates with the Studio runtime token', async () => {
    const token = createStudioRuntimeToken();
    const app = createProviderCredentialsRoute({ token, service: fakeService() });

    expect((await app.request('/')).status).toBe(403);
    expect(
      (
        await app.request('/', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: [] }),
        })
      ).status
    ).toBe(403);
  });

  it('returns a sanitized no-store resource', async () => {
    const service = fakeService();
    const read = vi.spyOn(service, 'read');
    const app = createProviderCredentialsRoute({ service });

    const response = await app.request('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(read).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body).toEqual({ resource: resource() });
    expect(JSON.stringify(body)).not.toContain('test-secret');
  });

  it('parses and delegates one exact update without logging or returning values', async () => {
    const service = fakeService();
    const update = vi.spyOn(service, 'update');
    const app = createProviderCredentialsRoute({ service });
    const request = {
      changes: [
        { provider: 'fal-ai', value: 'submitted-test-secret' },
        { provider: 'world-labs', value: 'submitted-world-labs-secret' },
      ],
    };

    const response = await app.request('/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(update).toHaveBeenCalledWith({ update: request });
    expect(JSON.stringify(await response.json())).not.toContain(
      'submitted-test-secret'
    );
  });

  it('rejects malformed envelopes before calling Core', async () => {
    const service = fakeService();
    const update = vi.spyOn(service, 'update');
    const app = createProviderCredentialsRoute({ service });

    const response = await app.request('/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: [
          {
            provider: 42,
            value: 'submitted-test-secret',
            unexpected: true,
          },
        ],
        unexpectedRoot: true,
      }),
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER050',
        issues: [
          { location: { path: ['unexpectedRoot'] } },
          { location: { path: ['changes', '0', 'unexpected'] } },
          { location: { path: ['changes', '0', 'provider'] } },
        ],
      },
    });
  });

  it('maps Core validation to 400 and storage failure to 500', async () => {
    const validation = createProviderCredentialsRoute({
      service: {
        ...fakeService(),
        async update() {
          throw new StructuredError({
            code: 'PROVIDER_CREDENTIALS001',
            message: 'Provider credential update is invalid.',
          });
        },
      },
    });
    const storage = createProviderCredentialsRoute({
      service: {
        ...fakeService(),
        async update() {
          throw new StructuredError({
            code: 'PROVIDER_CREDENTIALS003',
            message: 'Renku provider credentials could not be saved.',
          });
        },
      },
    });

    const request = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: [{ provider: 'fal-ai', value: 'submitted-test-secret' }],
      }),
    };
    expect((await validation.request('/', request)).status).toBe(400);
    expect((await storage.request('/', request)).status).toBe(500);
  });

  it('uses the configured isolated home directory for its default service', async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), 'renku-studio-credentials-'));
    const app = createProviderCredentialsRoute({ homeDir });

    const updateResponse = await app.request('/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: [
          {
            provider: 'fal-ai',
            value: 'isolated-test-secret',
          },
        ],
      }),
    });

    expect(updateResponse.status).toBe(200);
    expect(JSON.stringify(await updateResponse.json())).not.toContain(
      'isolated-test-secret'
    );
    await expect(
      readFile(path.join(homeDir, '.config', 'renku', '.env'), 'utf8')
    ).resolves.toContain('FAL_KEY="isolated-test-secret"');
  });
});

function fakeService(): ProviderCredentialsRouteService {
  return {
    async read() {
      return resource();
    },
    async update() {
      return resource();
    },
  };
}

function resource() {
  return {
    providers: [
      {
        provider: 'fal-ai',
        label: 'fal.ai',
        configured: true,
      },
      {
        provider: 'elevenlabs',
        label: 'ElevenLabs',
        configured: false,
      },
      {
        provider: 'world-labs',
        label: 'World Labs',
        configured: true,
      },
    ],
  };
}
