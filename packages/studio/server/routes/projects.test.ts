import fs from 'node:fs/promises';
import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
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

  it('serves project cover images', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('cover bytes'));
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/constantinople/cover');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    await expect(response.text()).resolves.toBe('cover bytes');
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
