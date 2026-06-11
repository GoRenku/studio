import type { Project } from '@gorenku/studio-core/client';
import type {
  AppendStudioEventInput,
  StudioCoordinationService,
  StudioEvent,
} from '@gorenku/studio-core/server';
import { describe, expect, it } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createStudioEventsRoute, type CreateStudioEventsRouteOptions } from './studio-events.js';

describe('studio events Hono route', () => {
  it('accepts CLI project resource change notifications with the notification token', async () => {
    const token = createStudioRuntimeToken();
    const appended: AppendStudioEventInput[] = [];
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService(appended),
    });

    const response = await app.request('/project-resources-changed', {
      method: 'POST',
      body: JSON.stringify({
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        resourceKeys: ['surface:visual-language:lookbook:lookbook_test0001'],
        source: { kind: 'cli', command: 'media import' },
        operationId: 'studio_operation_test',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(200);
    expect(appended).toEqual([
      {
        type: 'studio.projectResourcesChanged',
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        resourceKeys: ['surface:visual-language:lookbook:lookbook_test0001'],
        source: { kind: 'cli', command: 'media import' },
        operationId: 'studio_operation_test',
      },
    ]);
    await expect(response.json()).resolves.toMatchObject({
      event: {
        type: 'studio.projectResourcesChanged',
        resourceKeys: ['surface:visual-language:lookbook:lookbook_test0001'],
      },
    });
  });

  it('rejects CLI project resource change notifications without the notification token', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService([]),
    });

    const response = await app.request('/project-resources-changed', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER022' },
    });
  });

  it('rejects CLI project resource change notifications from unexpected browser origins', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService([]),
    });

    const response = await app.request('/project-resources-changed', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://untrusted.example',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER020' },
    });
  });

  it('returns structured diagnostics for empty resource notification keys', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService([]),
    });

    const response = await app.request('/project-resources-changed', {
      method: 'POST',
      body: JSON.stringify({
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        resourceKeys: [],
        source: { kind: 'cli', command: 'media import' },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER030',
        issues: [
          {
            code: 'STUDIO_SERVER030',
            severity: 'error',
            message: 'resourceKeys must include at least one key.',
          },
        ],
      },
    });
  });

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

function fakeCoordinationService(
  appended: AppendStudioEventInput[]
): StudioCoordinationService {
  return {
    async appendStudioEvent(input) {
      appended.push(input);
      return {
        ...input,
        id: 'studio_event_test',
        version: '0.1.0',
        createdAt: '2026-06-11T10:00:00.000Z',
      } as StudioEvent;
    },
    async readStudioEvents() {
      return { events: [], warnings: [], nextCursor: '0' };
    },
    async readStudioCurrent() {
      return {
        studio: { running: false },
        project: null,
        selection: null,
        context: null,
        pendingRequest: null,
        warnings: [],
      };
    },
  };
}

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
