import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createProjectsRoute } from './projects.js';

describe('projects Hono route', () => {
  it('creates a Project through the authenticated Core service boundary', async () => {
    const token = createStudioRuntimeToken();
    const projectData = fakeProjectDataService();
    const createMovieProject = vi.spyOn(projectData, 'createMovieProject');
    const app = createProjectsRoute({ projectData, token });

    const response = await app.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': token.value,
      },
      body: JSON.stringify({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      }),
    });

    expect(response.status).toBe(201);
    expect(createMovieProject).toHaveBeenCalledWith({
      projectName: 'the-glass-harbor',
      title: 'The Glass Harbor',
    });
    await expect(response.json()).resolves.toMatchObject({
      report: {
        projectName: 'the-glass-harbor',
        projectPath: '/tmp/renku/the-glass-harbor',
        databasePath: '/tmp/renku/the-glass-harbor/.renku/project.sqlite',
        created: { languages: 1, scenes: 0 },
      },
    });
  });

  it('rejects malformed Project creation requests with structured issues', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName: 12, unexpected: true }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER040',
        issues: [
          { code: 'STUDIO_SERVER012', location: { path: ['unexpected'] } },
          { code: 'STUDIO_SERVER010', location: { path: ['projectName'] } },
          { code: 'STUDIO_SERVER010', location: { path: ['title'] } },
        ],
      },
    });
  });

  it('requires the Studio runtime token when creating a Project', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
      token: createStudioRuntimeToken(),
    });

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER021' },
    });
  });

  it('preserves Core creation diagnostics', async () => {
    const projectData = fakeProjectDataService();
    projectData.createMovieProject = async () => {
      throw new StructuredError({
        code: 'PROJECT_DATA024',
        message: 'Project folder already exists.',
        issues: [
          createDiagnosticError(
            'PROJECT_DATA024',
            'Folder name is already in use.',
            { path: ['projectName'] }
          ),
        ],
        suggestion: 'Choose another Folder name.',
      });
    };
    const app = createProjectsRoute({ projectData });

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PROJECT_DATA024',
        issues: [{ location: { path: ['projectName'] } }],
        suggestion: 'Choose another Folder name.',
      },
    });
  });

  it('deletes a Project through the authenticated Core service boundary', async () => {
    const token = createStudioRuntimeToken();
    const projectData = fakeProjectDataService();
    const deleteProject = vi.spyOn(projectData, 'deleteProject');
    const app = createProjectsRoute({ projectData, token });

    const response = await app.request('/the-glass-harbor', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': token.value,
      },
      body: JSON.stringify({
        confirmationProjectName: 'the-glass-harbor',
      }),
    });

    expect(response.status).toBe(200);
    expect(deleteProject).toHaveBeenCalledWith({
      projectName: 'the-glass-harbor',
      confirmationProjectName: 'the-glass-harbor',
    });
    await expect(response.json()).resolves.toEqual({
      report: {
        projectName: 'the-glass-harbor',
        projectPath: '/tmp/renku/the-glass-harbor',
        deleted: true,
      },
    });
  });

  it('requires the Studio runtime token when deleting a Project', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
      token: createStudioRuntimeToken(),
    });

    const response = await app.request('/the-glass-harbor', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationProjectName: 'the-glass-harbor',
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER021' },
    });
  });

  it('rejects malformed Project deletion confirmations', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/the-glass-harbor', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationProjectName: 12,
        unexpected: true,
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER041',
        issues: [
          { code: 'STUDIO_SERVER012', location: { path: ['unexpected'] } },
          {
            code: 'STUDIO_SERVER010',
            location: { path: ['confirmationProjectName'] },
          },
        ],
      },
    });
  });

  it('preserves a Core deletion confirmation diagnostic', async () => {
    const projectData = fakeProjectDataService();
    projectData.deleteProject = async () => {
      throw new StructuredError({
        code: 'PROJECT_DATA027',
        message: 'Project deletion confirmation does not match.',
        issues: [
          createDiagnosticError(
            'PROJECT_DATA027',
            'Type the exact Project name to confirm deletion.',
            { path: ['confirmationProjectName'] }
          ),
        ],
        suggestion: 'Type the-glass-harbor exactly.',
      });
    };
    const app = createProjectsRoute({ projectData });

    const response = await app.request('/the-glass-harbor', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationProjectName: 'The Glass Harbor',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PROJECT_DATA027',
        issues: [{ location: { path: ['confirmationProjectName'] } }],
        suggestion: 'Type the-glass-harbor exactly.',
      },
    });
  });

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
            projectName: 'constantinople',
            coverUrl: '/studio-api/projects/constantinople/assets/asset_project_cover/files/asset_file_project_cover',
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
        project: { projectName: 'constantinople' },
        coverUrl: '/studio-api/projects/constantinople/assets/asset_project_cover/files/asset_file_project_cover',
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
  });

  it('does not expose the retired special Project cover route', async () => {
    const app = createProjectsRoute({
      projectData: fakeProjectDataService(),
    });

    const response = await app.request('/constantinople/cover');

    expect(response.status).toBe(404);
  });

  it('serializes structured errors with issues', async () => {
    const app = createProjectsRoute({
      projectData: {
        ...fakeProjectDataService(),
        async listLibrary() {
          throw new StructuredError({
            code: 'PROJECT_DATA999',
            message: 'Project data failed validation.',
            issues: [
              createDiagnosticError(
                'PROJECT_DATA999',
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
        code: 'PROJECT_DATA999',
        issues: [
          {
            code: 'PROJECT_DATA999',
            message: 'project.name is required.',
          },
        ],
      },
    });
  });
});
