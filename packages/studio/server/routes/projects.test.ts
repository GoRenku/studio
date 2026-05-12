import fs from 'node:fs/promises';
import type {
  Asset,
  Project,
  ProjectLibrary,
} from '@gorenku/studio-core';
import type { CreateProjectsRouteOptions } from './projects.js';
import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { createProjectsRoute } from './projects.js';

describe('projects Hono route', () => {
  it('lists projects through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      library: {
        projects: [
          {
            name: 'constantinople',
            coverUrl: '/studio-api/projects/constantinople/cover',
          },
        ],
      },
    });
  });

  it('reads one project through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/constantinople');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      project: {
        identity: {
          name: 'constantinople',
        },
        coverUrl: '/studio-api/projects/constantinople/cover',
      },
    });
  });

  it('updates project information through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: {
        ...fakeProjectDataService(),
        async updateProjectInformation(input) {
          return {
            ...makeProject(),
            identity: {
              ...makeProject().identity,
              title: input.information.title,
              aspectRatio: input.information.aspectRatio,
            },
            languages: input.information.languages.map((language, index) => ({
              id: `language_${index + 1}`,
              ...language,
            })),
          };
        },
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
      project: {
        identity: {
          name: 'constantinople',
          title: 'The Siege Machine',
          aspectRatio: '21:9',
        },
        languages: [
          {
            localeTag: 'en-US',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
          },
        ],
        coverUrl: '/studio-api/projects/constantinople/cover',
      },
    });
  });

  it('reads Markdown asset content through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request(
      '/constantinople/markdown-assets/asset_clip_summary/files/asset_file_clip_summary/content'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: {
        assetId: 'asset_clip_summary',
        assetFileId: 'asset_file_clip_summary',
        projectRelativePath:
          'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
        content: 'Establish the movie.',
      },
    });
  });

  it('updates Markdown asset content through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request(
      '/constantinople/markdown-assets/asset_clip_summary/files/asset_file_clip_summary/content',
      {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Frame the city as a strategic obsession.',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: {
        assetId: 'asset_clip_summary',
        assetFileId: 'asset_file_clip_summary',
        projectRelativePath:
          'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
        content: 'Frame the city as a strategic obsession.',
      },
      project: {
        identity: {
          name: 'constantinople',
        },
      },
    });
  });

  it('lists cast member assets through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/assets'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assets: [
        {
          assetId: 'asset_cast_reference',
          target: { kind: 'castMember', castMemberId: 'cast_narrator' },
          title: 'Narrator reference',
        },
      ],
    });
  });

  it('selects and unselects cast member assets through ProjectDataService', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const selected = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference/select',
      { method: 'POST' }
    );
    const unselected = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference/select',
      { method: 'DELETE' }
    );

    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      asset: {
        assetId: 'asset_cast_reference',
        selection: { kind: 'select', order: 1 },
      },
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      asset: {
        assetId: 'asset_cast_reference',
        selection: { kind: 'take' },
      },
    });
  });

  it('serves a registered cast member asset file', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('png bytes'));
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference/files/asset_file_cast_reference'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=31536000, immutable'
    );
    await expect(response.text()).resolves.toBe('png bytes');
  });

  it('rejects malformed Markdown asset content updates', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request(
      '/constantinople/markdown-assets/asset_clip_summary/files/asset_file_clip_summary/content',
      {
        method: 'PATCH',
        body: JSON.stringify({
          content: 42,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER014',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'STUDIO_SERVER010',
            message: 'content must be a string.',
          }),
        ]),
      },
    });
  });

  it('rejects project information payloads that try to change project name', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

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

  it('serializes structured errors with issues', async () => {
    const app = createProjectsRoute({
      projectData: {
        ...fakeProjectDataService(),
        async listLibrary() {
          throw new StructuredError({
            code: 'PROJECT_SETUP999',
            message: 'Project setup YAML failed validation.',
            issues: [
              createDiagnosticError(
                'PROJECT_SETUP003',
                'project.name is required.',
                { path: ['project', 'name'] }
              ),
            ],
          });
        },
      },
    });

    const response = await app.request('/');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PROJECT_SETUP999',
        issues: [
          {
            code: 'PROJECT_SETUP003',
            message: 'project.name is required.',
          },
        ],
      },
    });
  });
});

function fakeProjectDataService(): NonNullable<CreateProjectsRouteOptions['projectData']> {
  const project = makeProject();
  const library: ProjectLibrary = {
    storageRoot: '/tmp/renku',
    projects: [
      {
        name: project.identity.name,
        title: project.identity.title,
        type: project.identity.type,
        folderPath: project.identity.folderPath,
        coverImage: project.coverImage,
        counts: project.counts,
        validationError: null,
      },
    ],
  };

  return {
    async listLibrary() {
      return library;
    },
    async readProject() {
      return project;
    },
    async updateProjectInformation() {
      return project;
    },
    async readMarkdownAssetContent(input) {
      return {
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        projectRelativePath:
          'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
        content: 'Establish the movie.',
      };
    },
    async updateMarkdownAssetContent(input) {
      return {
        content: {
          assetId: input.assetId,
          assetFileId: input.assetFileId,
          projectRelativePath:
            'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
          content: input.content,
        },
        project,
      };
    },
    async resolveCoverImage() {
      return '/tmp/renku/constantinople/cover.png';
    },
    async resolveProjectAssetFile(input: { assetId: string }) {
      const asset = makeAsset(input.assetId);
      return {
        asset,
        file: asset.files[0],
        absolutePath: '/tmp/renku/constantinople/working-assets/base/cast/reference.png',
      };
    },
    async listAssets() {
      return [makeAsset('asset_cast_reference')];
    },
    async createAssetSelect(input) {
      return {
        ...makeAsset(input.assetId),
        selection: { kind: 'select', order: 1 },
      };
    },
    async removeAssetSelect(input) {
      return makeAsset(input.assetId);
    },
    async exportProductionAssets() {
      return {
        copiedFileCount: 1,
        skippedFileCount: 0,
        prunedFileCount: 0,
        unmanagedFileCount: 0,
        variants: [],
      };
    },
  };
}

function makeAsset(assetId: string): Asset {
  return {
    assetId,
    relationshipId: 'cast_asset_test0001',
    target: { kind: 'castMember', castMemberId: 'cast_narrator' },
    localeId: null,
    type: 'reference',
    selection: { kind: 'take' },
    availability: 'ready',
    mediaKind: 'image',
    title: 'Narrator reference',
    oneLineSummary: null,
    origin: 'imported',
    role: 'reference',
    sortOrder: 1,
    files: [
      {
        id: 'asset_file_cast_reference',
        role: 'primary',
        projectRelativePath:
          'working-assets/base/cast/narrator/reference.png' as Asset['files'][number]['projectRelativePath'],
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 12,
        contentHash: null,
        width: null,
        height: null,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
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
    coverImage: { fileName: 'cover.png' },
    languages: [],
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [],
    continuityReferences: [],
    episodes: [],
    sequences: [],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 0,
      continuityReferences: 0,
      episodes: 0,
      sequences: 0,
      scenes: 0,
      clips: 0,
    },
  };
}
