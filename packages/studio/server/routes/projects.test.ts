import type {
  Project,
  ProjectCreateReport,
  ProjectLibrary,
} from '@gorenku/studio-core';
import type { ProjectDataService } from '@gorenku/studio-core/node';
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
});

function fakeProjectDataService(): ProjectDataService {
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
    async createFromSetup(): Promise<ProjectCreateReport> {
      throw new Error('createFromSetup is not used by these route tests.');
    },
    async listLibrary() {
      return library;
    },
    async readProject() {
      return project;
    },
    async resolveCoverImage() {
      return '/tmp/renku/constantinople/cover.png';
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
