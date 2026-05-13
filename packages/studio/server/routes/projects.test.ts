import fs from 'node:fs/promises';
import type {
  Asset,
  Project,
  ProjectLibrary,
  ProjectShell,
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
    const body = await response.json();
    expect(body).toMatchObject({
      project: {
        identity: {
          name: 'constantinople',
        },
        coverUrl: '/studio-api/projects/constantinople/cover',
        navigation: {
          cast: {
            items: [
              {
                id: 'cast_narrator',
                name: 'Narrator',
              },
            ],
          },
        },
      },
    });
    expect(body?.project).not.toHaveProperty('sequences');
    expect(body?.project).not.toHaveProperty('episodes');
  });

  it('returns paginated story navigation resources with counts', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const sequenceResponse = await app.request('/constantinople/sequences');
    const sceneResponse = await app.request(
      '/constantinople/sequences/seq_opening/scenes'
    );
    const clipResponse = await app.request('/constantinople/scenes/scene_opening/clips');

    expect(sequenceResponse.status).toBe(200);
    await expect(sequenceResponse.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'seq_opening',
            sceneCount: 1,
            clipCount: 1,
          },
        ],
      },
    });
    expect(sceneResponse.status).toBe(200);
    await expect(sceneResponse.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'scene_opening',
            sequenceId: 'seq_opening',
            clipCount: 1,
          },
        ],
      },
    });
    expect(clipResponse.status).toBe(200);
    await expect(clipResponse.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'clip_opening',
            sceneId: 'scene_opening',
            title: 'Opening Image',
          },
        ],
      },
    });
  });

  it('returns structured errors for malformed navigation pagination', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/constantinople/sequences?limit=wide');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER030',
        issues: [
          {
            location: {
              path: ['limit'],
            },
          },
        ],
      },
    });
  });

  it('rejects unsupported Movie Studio selection context types', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request(
      '/constantinople/movie-studio-selection/context',
      {
        method: 'POST',
        body: JSON.stringify({
          selection: { type: 'episode', id: 'ep_1' },
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER034',
        issues: [
          {
            location: {
              path: ['selection', 'type'],
            },
          },
        ],
      },
    });
  });

  it('updates project information through ProjectDataService', async () => {
    let currentProject = makeProject();
    const app = createProjectsRoute({
      projectData: {
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
      resourceKeys: [
        'markdown:asset_clip_summary:asset_file_clip_summary',
        'assets:clip:clip_1',
        'surface:clip-design:clip_1',
      ],
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
    async readProjectShell() {
      return makeProjectShell(project);
    },
    async readProjectInformationResource() {
      return {
        title: project.identity.title,
        aspectRatio: project.identity.aspectRatio,
        logline: project.identity.logline,
        languages: project.languages,
      };
    },
    async updateProjectInformation() {
      return {
        title: project.identity.title,
        aspectRatio: project.identity.aspectRatio,
        logline: project.identity.logline,
        languages: project.languages,
      };
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
        resourceKeys: [
          `markdown:${input.assetId}:${input.assetFileId}`,
          'assets:clip:clip_1',
          'surface:clip-design:clip_1',
        ],
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
    async listAssetPage() {
      return {
        items: [makeAsset('asset_cast_reference')],
        nextCursor: null,
      };
    },
    async listCastNavigation() {
      return makeProjectShell(project).navigation.cast;
    },
    async listContinuityReferenceNavigation() {
      return makeProjectShell(project).navigation.continuityReferences;
    },
    async listEpisodeNavigation() {
      return { items: [], nextCursor: null };
    },
    async listStandaloneMovieSequenceNavigation() {
      const narrative = makeProjectShell(project).navigation.narrative;
      return narrative.projectType === 'standaloneMovie'
        ? narrative.sequences
        : { items: [], nextCursor: null };
    },
    async listEpisodeSequenceNavigation() {
      return { items: [], nextCursor: null };
    },
    async listSceneNavigation() {
      return {
        items: [
          {
            id: 'scene_opening',
            sequenceId: 'seq_opening',
            title: 'Opening Scene',
            clipCount: 1,
          },
        ],
        nextCursor: null,
      };
    },
    async listClipNavigation() {
      return {
        items: [
          {
            id: 'clip_opening',
            sceneId: 'scene_opening',
            title: 'Opening Image',
          },
        ],
        nextCursor: null,
      };
    },
    async readCastDesignResource() {
      return {
        castMember: project.cast[0],
        selectedAssets: [],
        activeTakePage: {
          items: [makeAsset('asset_cast_reference')],
          nextCursor: null,
        },
        countsByRole: [],
      };
    },
    async readClipDesignResource() {
      return {
        clip: project.sequences[0]!.scenes[0]!.clips[0]!,
        scene: {
          id: 'scene_opening',
          sequenceId: 'seq_opening',
          title: 'Opening Scene',
          clipCount: 1,
        },
        sequence: {
          id: 'seq_opening',
          number: 1,
          title: 'Opening',
          sceneCount: 1,
          clipCount: 1,
        },
        selectedAssets: [],
        activeTakePage: { items: [], nextCursor: null },
      };
    },
    async readStudioSelectionContext() {
      return {
        valid: true,
        selection: { type: 'projectInformation' },
        context: { surface: 'project-information' },
        resourceKeys: ['project-information'],
      };
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

function makeProjectShell(project: Project): ProjectShell {
  return {
    identity: project.identity,
    coverImage: project.coverImage,
    languages: project.languages,
    visualLanguageCategories: project.visualLanguageCategories,
    visualLanguage: project.visualLanguage,
    cast: project.cast,
    continuityReferences: project.continuityReferences,
    counts: project.counts,
    navigation: {
      cast: {
        items: project.cast.map((castMember) => ({
          id: castMember.id,
          name: castMember.name,
          kind: castMember.kind,
          role: castMember.role,
        })),
        nextCursor: null,
      },
      visualLanguage: { items: [], nextCursor: null },
      continuityReferences: { items: [], nextCursor: null },
      narrative: {
        projectType: 'standaloneMovie',
        sequences: {
          items: project.sequences.map((sequence) => ({
            id: sequence.id,
            number: sequence.number,
            title: sequence.title,
            shortTitle: sequence.shortTitle,
            sceneCount: sequence.scenes.length,
            clipCount: sequence.scenes.reduce(
              (count, scene) => count + scene.clips.length,
              0
            ),
          })),
          nextCursor: null,
        },
      },
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
    coverImage: { fileName: 'cover.png' },
    languages: [],
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [
      {
        id: 'cast_narrator',
        name: 'Narrator',
        kind: 'narrator',
        role: 'voiceover',
      },
    ],
    continuityReferences: [],
    episodes: [],
    sequences: [
      {
        id: 'seq_opening',
        number: 1,
        title: 'Opening',
        scenes: [
          {
            id: 'scene_opening',
            title: 'Opening Scene',
            clips: [
              {
                id: 'clip_opening',
                title: 'Opening Image',
              },
            ],
          },
        ],
      },
    ],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
  };
}
