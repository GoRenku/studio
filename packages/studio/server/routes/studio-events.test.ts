import type { Project } from '@gorenku/studio-core/client';
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
    async readSceneShotListResource() {
      return {
        scene: {
          id: 'scene_test0001',
          sequenceId: 'sequence_test0001',
          title: 'Opening council',
        },
        sequence: {
          id: 'sequence_test0001',
          actId: 'act_test0001',
          number: 1,
          title: 'The Offer',
          sceneCount: 1,
        },
        act: {
          id: 'act_test0001',
          title: 'The Offer',
          sequenceCount: 1,
          sceneCount: 1,
        },
        projectAspectRatio: '16:9',
        activeShotListId: null,
        activeShotList: null,
        storyboardSheet: null,
        storyboardImagesByShotId: {},
        castMemberLabels: {},
        locationLabels: {},
      };
    },
  };
}

function makeProject(): Project {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      folderPath: '/tmp/renku/constantinople',
      databasePath: '/tmp/renku/constantinople/.renku/project.sqlite',
      aspectRatio: '16:9',
    },
    coverImage: null,
    languages: [],
    cast: [],
    locations: [],
    sequences: [],
    counts: {
      languages: 0,
      castMembers: 0,
      locations: 0,
      acts: 0,
      sequences: 0,
      scenes: 0,
    },
  };
}
