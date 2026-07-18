import type { Project } from '@gorenku/studio-core/client';
import type {
  AppendStudioEventInput,
  GenerationPreview,
  GenerationPreviewResource,
  StudioCoordinationService,
  StudioEvent,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
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

  it('accepts CLI generation preview notifications with the notification token', async () => {
    const token = createStudioRuntimeToken();
    const appended: AppendStudioEventInput[] = [];
    const preview = generationPreviewFixture();
    let projectionIndex = 0;
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService(appended),
      projectData: fakeProjectDataService(),
      generationPreviewProjection: async (input) => {
        expect(input.projectName).toBe('constantinople');
        expect(input.preview).toEqual(coreGenerationPreviewResourceFixture());
        projectionIndex += 1;
        return {
          ...studioGenerationPreviewFixture(),
          previewId: `generation_preview_test_${projectionIndex}`,
        };
      },
    });

    const response = await app.request('/generation-previews', {
      method: 'POST',
      body: JSON.stringify({
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        previews: [preview, preview],
        source: { kind: 'cli', command: 'generation preview show' },
        operationId: 'studio_operation_preview_test',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(200);
    expect(appended).toEqual([
      {
        type: 'studio.generationPreviewsRequested',
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        previews: [
          { ...studioGenerationPreviewFixture(), previewId: 'generation_preview_test_1' },
          { ...studioGenerationPreviewFixture(), previewId: 'generation_preview_test_2' },
        ],
        source: { kind: 'cli', command: 'generation preview show' },
        operationId: 'studio_operation_preview_test',
      },
    ]);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      eventId: 'studio_event_test',
      previewIds: ['generation_preview_test_1', 'generation_preview_test_2'],
    });
    expect(responseBody.event.previews).toHaveLength(2);
    expect(responseBody.event.previews[0]).toMatchObject({
      subject: {
        projectLabel: 'Preparation of the Siege',
        sceneLabel: 'Opening council',
        takeLabel: 'Take 1',
        shotLabel: 'Shot 1',
      },
      references: {
        slots: [{
          eligibleCandidates: [{
            browserUrl:
              '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
          }],
        }],
      },
    });
  });

  it('rejects generation preview notifications when references cannot be resolved', async () => {
    const token = createStudioRuntimeToken();
    const appended: AppendStudioEventInput[] = [];
    let projectionCount = 0;
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService(appended),
      projectData: fakeProjectDataService(),
      generationPreviewProjection: async () => {
        projectionCount += 1;
        if (projectionCount === 1) {
          return studioGenerationPreviewFixture();
        }
        throw createStructuredError({
          code: 'CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND',
          message: 'Generation preview reference asset file was not found.',
        });
      },
    });

    const response = await app.request('/generation-previews', {
      method: 'POST',
      body: JSON.stringify({
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        previews: [generationPreviewFixture(), generationPreviewFixture()],
        source: { kind: 'cli', command: 'generation preview show' },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(400);
    expect(projectionCount).toBe(2);
    expect(appended).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND',
      },
    });
  });

  it('rejects generation preview notifications with provider upload URLs', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService([]),
      projectData: {
        ...fakeProjectDataService(),
        async buildGenerationPreviewResource() {
          throw createStructuredError({
            code: 'CORE_GENERATION_PREVIEW_INVALID',
            message: 'Generation preview contains an unsafe reference URL.',
            issues: [{
              code: 'CORE_GENERATION_PREVIEW_REFERENCE_FIELD_UNSUPPORTED',
              severity: 'error',
              message: 'Reference URLs are server-owned.',
              location: { path: ['preview', 'references', '0'] },
            }],
          });
        },
      },
    });
    const preview = generationPreviewFixture();
    preview.references[0] = {
      ...preview.references[0],
      browserUrl: 'https://v3.fal.media/upload/private.png',
    } as never;

    const response = await app.request('/generation-previews', {
      method: 'POST',
      body: JSON.stringify({
        projectRef: {
          name: 'constantinople',
          id: 'project_test0001',
          storageRoot: '/tmp/renku',
        },
        previews: [preview],
        source: { kind: 'cli', command: 'generation preview show' },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      },
    });
    expect(body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_GENERATION_PREVIEW_REFERENCE_FIELD_UNSUPPORTED',
        }),
      ])
    );
  });

  it('rejects generation preview notifications without a projectRef', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService([]),
    });

    const response = await app.request('/generation-previews', {
      method: 'POST',
      body: JSON.stringify({
        previews: [generationPreviewFixture()],
        source: { kind: 'cli', command: 'generation preview show' },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER032',
        issues: [
          {
            message: 'projectRef must be an object.',
          },
        ],
      },
    });
  });

  it('rejects generation preview notifications for an unknown projectRef', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioEventsRoute({
      token,
      cliNotificationToken: 'notification-token-test',
      coordination: fakeCoordinationService([]),
    });

    const response = await app.request('/generation-previews', {
      method: 'POST',
      body: JSON.stringify({
        projectRef: {
          name: 'other-project',
          id: 'project_other0001',
          storageRoot: '/tmp/renku/other-project',
        },
        previews: [generationPreviewFixture()],
        source: { kind: 'cli', command: 'generation preview show' },
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Notification-Token': 'notification-token-test',
      },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: expect.any(String),
      },
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
    async readSceneBeatSheetResource() {
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
        activeBeatSheetId: null,
        activeBeatSheet: null,
        storyboardImagesByBeatId: {},
        castMemberLabels: {},
        castMemberImages: {},
        locationLabels: {},
      };
    },
    async buildGenerationPreviewResource() {
      return coreGenerationPreviewResourceFixture();
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

function generationPreviewFixture(): GenerationPreview {
  return {
    spec: {
      executionKind: 'renku-managed',
      purpose: 'image.create',
      target: { kind: 'project', id: 'project_test0001' },
      model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
      values: { prompt: 'Create a motion annotated video prompt image.' },
      references: [],
    },
    referenceGuide: {
      sections: [],
      notices: [],
    },
    references: [],
    diagnostics: [],
  };
}

function coreGenerationPreviewResourceFixture() {
  return {
    kind: 'generationPreview' as const,
    previewId: 'generation_preview_test',
    purpose: 'image.create' as const,
    project: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
    },
    target: { kind: 'project' as const, id: 'project_test0001' },
    title: 'Choreography reference image',
    subject: {
      projectLabel: 'Preparation of the Siege',
      sceneLabel: 'Opening council',
      takeLabel: 'Take 1',
      shotLabel: 'Shot 1',
    },
    model: {
      provider: 'fal-ai',
      modelId: 'openai/gpt-image-2',
      mediaKind: 'image' as const,
      executionPath: 'renku-managed' as const,
    },
    finalPrompt: {
      authoredText: 'Create a motion annotated video prompt image.',
      providerText: 'Create a motion annotated video prompt image.',
    },
    references: {
      slots: [{
        label: 'Visual language',
        placement: {
          kind: 'slot' as const,
          sectionId: 'visual-language',
          slotId: 'lookbook',
        },
        current: null,
        eligibleCandidates: [{
          kind: 'image' as const,
          role: 'style',
          label: 'Storyboard Lookbook Sheet',
          assetId: 'asset_style',
          assetFileId: 'asset_file_style',
          selected: true,
        }],
      }],
      additional: [],
    },
    configuration: { sections: [] },
    authoring: { models: [] },
    diagnostics: [],
  };
}

function studioGenerationPreviewFixture(): GenerationPreviewResource {
  const preview = coreGenerationPreviewResourceFixture();
  return {
    ...preview,
    references: {
      slots: preview.references.slots.map((slot) => ({
        ...slot,
        current: null,
        eligibleCandidates: slot.eligibleCandidates.map((reference) => ({
          ...reference,
          browserUrl:
            '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
        })),
      })),
      additional: [],
    },
  };
}
