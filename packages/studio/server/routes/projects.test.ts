import type {
  Project,
  ProjectLibrary,
} from '@gorenku/studio-core';
import type { CreateProjectsRouteOptions } from './projects.js';
import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { describe, expect, it } from 'vitest';
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
    async resolveCoverImage() {
      return '/tmp/renku/constantinople/cover.png';
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
