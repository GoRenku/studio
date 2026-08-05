import { Hono } from 'hono';
import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeProject, makeProjectShell } from '../testing/route-fixtures.js';
import { createProjectInformationRoute } from './project-information.js';

function createMountedProjectInformationRoute(
  projectData = fakeProjectDataService()
) {
  return new Hono().route(
    '/:projectName',
    createProjectInformationRoute({
      projectData,
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('project information Hono route', () => {
  it('reads Project Information', async () => {
    const app = createMountedProjectInformationRoute();

    const response = await app.request('/constantinople/information');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        title: 'Preparation of the Siege',
        languages: [],
      },
    });
  });

  it('patches Project Information through ProjectDataService', async () => {
    const patchProjectInformation = vi.fn(async () => ({
      title: 'The Siege Machine',
      aspectRatio: '21:9',
      logline: undefined,
      languages: makeProjectShell(makeProject()).languages,
    }));
    const app = createMountedProjectInformationRoute({
      ...fakeProjectDataService(),
      patchProjectInformation,
    });

    const response = await app.request('/constantinople/information', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: null,
        languages: [
          {
            operation: 'setBase',
            localeTag: 'tr-TR',
          },
        ],
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
      },
    });
    expect(patchProjectInformation).toHaveBeenCalledOnce();
    expect(patchProjectInformation).toHaveBeenCalledWith({
      projectName: 'constantinople',
      patch: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: null,
        languages: [{ operation: 'setBase', localeTag: 'tr-TR' }],
      },
    });
  });

  it('rejects project name mutation attempts', async () => {
    const app = createMountedProjectInformationRoute();

    const response = await app.request('/constantinople/information', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'renamed-project',
        title: 'The Siege Machine',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER013',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'STUDIO_SERVER011',
          }),
        ]),
      },
    });
  });

  it('rejects malformed language payloads', async () => {
    const app = createMountedProjectInformationRoute();

    const response = await app.request('/constantinople/information', {
      method: 'PATCH',
      body: JSON.stringify({
        languages: 'English',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER013',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'STUDIO_SERVER010',
            message: 'languages must be an array.',
          }),
        ]),
      },
    });
  });

  it('parses every project language operation without domain interpretation', async () => {
    const patchProjectInformation = vi.fn(async () => ({
      title: 'Preparation of the Siege',
      aspectRatio: '16:9',
      languages: [],
    }));
    const app = createMountedProjectInformationRoute({
      ...fakeProjectDataService(),
      patchProjectInformation,
    });

    const languages = [
      {
        operation: 'add',
        localeTag: 'es-ES',
        displayName: 'Spanish',
        isBase: true,
      },
      {
        operation: 'update',
        localeTag: 'en-US',
        displayName: null,
        supportsAudio: false,
      },
      { operation: 'remove', localeTag: 'de-DE' },
      { operation: 'setBase', localeTag: 'fr-FR' },
    ];
    const response = await app.request('/constantinople/information', {
      method: 'PATCH',
      body: JSON.stringify({ languages }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(patchProjectInformation).toHaveBeenCalledWith({
      projectName: 'constantinople',
      patch: { languages },
    });
  });

  it('serializes structured Core issues without discarding details', async () => {
    const app = createMountedProjectInformationRoute({
      ...fakeProjectDataService(),
      async patchProjectInformation() {
        throw createStructuredError({
          code: 'PROJECT_DATA056',
          message: 'Project information failed validation.',
          issues: [createDiagnosticError(
            'PROJECT_DATA050',
            'Project title is required.',
            { path: ['title'], context: 'project information update' }
          )],
          suggestion: 'Enter a project title before saving.',
        });
      },
    });

    const response = await app.request('/constantinople/information', {
      method: 'PATCH',
      body: JSON.stringify({ title: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PROJECT_DATA056',
        message: 'Project information failed validation.',
        issues: [
          {
            code: 'PROJECT_DATA050',
            message: 'Project title is required.',
            severity: 'error',
          },
        ],
        suggestion: 'Enter a project title before saving.',
      },
    });
  });
});
