import type { Project } from '@gorenku/studio-core';
import { describe, expect, it } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createStudioEventsRoute, type CreateStudioEventsRouteOptions } from './studio-events.js';

describe('studio events Hono route', () => {
  it('validates focus requests against loaded project data', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/focus-requests/validate', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'constantinople',
        focus: {
          screen: 'movieStudio',
          selection: { type: 'scene', id: 'missing_scene' },
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': token.value,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      valid: false,
      reason: 'selectionNotFound',
      diagnostics: [
        {
          code: 'STUDIO_COORDINATION031',
          severity: 'error',
        },
      ],
    });
  });

  it('accepts valid focus requests', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/focus-requests/validate', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'constantinople',
        focus: {
          screen: 'movieStudio',
          selection: { type: 'projectInformation' },
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': token.value,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true });
  });

  it('returns structured diagnostics for malformed focus requests', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/focus-requests/validate', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'constantinople',
        focus: {
          screen: 'movieStudio',
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': token.value,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      valid: false,
      reason: 'unsupportedSelection',
      diagnostics: [
        {
          code: 'STUDIO_COORDINATION034',
          severity: 'error',
          message: 'Requested Studio focus selection is not supported.',
        },
      ],
    });
  });
});

function fakeProjectDataService(): NonNullable<CreateStudioEventsRouteOptions['projectData']> {
  const project = makeProject();

  return {
    async readProject() {
      return project;
    },
  };
}

function makeProject(): Project {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      folderPath: '/tmp/renku/constantinople',
      databasePath: '/tmp/renku/constantinople/.renku/project.sqlite',
    },
    coverImage: null,
    languages: [],
    visualLanguage: [],
    cast: [],
    episodes: [],
    sequences: [],
    counts: {
      languages: 0,
      visualLanguage: 0,
      castMembers: 0,
      episodes: 0,
      sequences: 0,
      scenes: 0,
      clips: 0,
    },
  };
}
