import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
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
    let currentProject = makeProject();
    const app = createMountedProjectInformationRoute({
      ...fakeProjectDataService(),
      async updateProjectInformation(input) {
        currentProject = {
          ...currentProject,
          identity: {
            ...currentProject.identity,
            title: input.information.title,
            aspectRatio: input.information.aspectRatio,
          },
          languages: input.information.languages.map((language, index) => ({
            id: `language_${index + 1}`,
            ...language,
          })),
        };
        return {
          title: currentProject.identity.title,
          aspectRatio: currentProject.identity.aspectRatio,
          logline: currentProject.identity.logline,
          languages: currentProject.languages,
        };
      },
      async readProjectInformationResource() {
        return {
          title: currentProject.identity.title,
          aspectRatio: currentProject.identity.aspectRatio,
          logline: currentProject.identity.logline,
          languages: currentProject.languages,
        };
      },
      async readProjectShell() {
        return makeProjectShell(currentProject);
      },
    });

    const response = await app.request('/constantinople/information', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: 'A sharper premise.',
        summary: 'A revised summary.',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
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
        languages: [
          {
            localeTag: 'en-US',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
          },
        ],
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
        languages: [],
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
        title: 'The Siege Machine',
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
});
