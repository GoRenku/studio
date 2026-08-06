import { Hono } from 'hono';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createProjectSettingsRoute } from './project-settings.js';

function createMountedRoute(
  projectData = fakeProjectDataService(),
  requireToken = async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }
) {
  return new Hono().route(
    '/:projectName',
    createProjectSettingsRoute({ projectData, requireToken })
  );
}

describe('Project Settings Hono route', () => {
  it('protects both reads and replacements with the supplied token middleware', async () => {
    const requireToken = vi.fn(async (c, next) => {
      if (c.req.header('X-Test-Token') !== 'accepted') {
        return c.json({ error: { code: 'TOKEN' } }, 401);
      }
      await next();
    });
    const app = createMountedRoute(fakeProjectDataService(), requireToken);

    expect((await app.request('/constantinople/settings')).status).toBe(401);
    expect(
      (
        await app.request('/constantinople/settings', {
          method: 'PUT',
          body: '{}',
          headers: { 'Content-Type': 'application/json' },
        })
      ).status
    ).toBe(401);
    expect(requireToken).toHaveBeenCalledTimes(2);
  });

  it('reads the Core Project Settings resource', async () => {
    const app = createMountedRoute();
    const response = await app.request('/constantinople/settings');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        project: { name: 'constantinople' },
        settings: { version: 1 },
      },
    });
  });

  it('passes parsed unknown JSON to Core and forwards its report unchanged', async () => {
    const replaceProjectSettings = vi.fn(async ({ settings }) => ({
      resource: {
        project: { id: 'project_test', name: 'constantinople' },
        settings,
      },
      resourceKeys: ['project-settings'],
    }));
    const app = createMountedRoute({
      ...fakeProjectDataService(),
      replaceProjectSettings,
    });
    const body = { version: 99, unvalidatedByAdapter: true };
    const response = await app.request('/constantinople/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(replaceProjectSettings).toHaveBeenCalledWith({
      projectName: 'constantinople',
      settings: body,
    });
    await expect(response.json()).resolves.toEqual({
      resource: {
        project: { id: 'project_test', name: 'constantinople' },
        settings: body,
      },
      resourceKeys: ['project-settings'],
    });
  });

  it('serializes structured Core validation errors', async () => {
    const app = createMountedRoute({
      ...fakeProjectDataService(),
      async replaceProjectSettings() {
        throw createStructuredError({
          code: 'PROJECT_SETTINGS002',
          message: 'Project Settings document is invalid.',
          suggestion: 'Fix every reported issue.',
        });
      },
    });
    const response = await app.request('/constantinople/settings', {
      method: 'PUT',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PROJECT_SETTINGS002' },
    });
  });
});
