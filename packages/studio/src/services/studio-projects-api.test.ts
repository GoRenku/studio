// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProject,
  deleteProject,
  patchProjectInformation,
  readProjectSettings,
  replaceProjectSettings,
} from './studio-projects-api';

describe('studio-projects-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the Core-owned Project Information patch unchanged', async () => {
    const patch = {
      title: 'The Siege Machine',
      logline: null,
      languages: [{ operation: 'setBase' as const, localeTag: 'tr-TR' }],
    };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        resource: {
          title: 'The Siege Machine',
          aspectRatio: '16:9',
          languages: [],
        },
      }),
    } as Response);

    await patchProjectInformation('constantinople', patch);

    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/projects/constantinople/information',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'token-123',
        },
        body: JSON.stringify(patch),
      }
    );
  });

  it('creates a Project with the exact shared request and runtime token', async () => {
    const report = {
      projectName: 'the-glass-harbor',
      projectPath: '/tmp/renku/the-glass-harbor',
      databasePath: '/tmp/renku/the-glass-harbor/.renku/project.sqlite',
      coverPath: null,
      created: {
        languages: 1,
        castMembers: 0,
        locations: 0,
        props: 0,
        acts: 0,
        sequences: 0,
        scenes: 0,
      },
      warnings: [],
    };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ report }),
    } as Response);

    await expect(
      createProject({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      })
    ).resolves.toEqual(report);
    expect(global.fetch).toHaveBeenCalledWith('/studio-api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': 'token-123',
      },
      body: JSON.stringify({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      }),
    });
  });

  it('rejects a successful creation response without a report', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    } as Response);

    await expect(
      createProject({ projectName: 'missing-report', title: 'Missing Report' })
    ).rejects.toThrow('Renku Studio API returned no Project creation report.');
  });

  it('preserves structured Project creation errors', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: {
          code: 'PROJECT_DATA024',
          message: 'Project folder already exists.',
          issues: [
            {
              code: 'PROJECT_DATA024',
              message: 'Folder name is already in use.',
              severity: 'error',
              location: { path: ['projectName'] },
            },
          ],
          suggestion: 'Choose another Folder name.',
        },
      }),
    } as Response);

    await expect(
      createProject({
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA024',
      issues: [{ location: { path: ['projectName'] } }],
      suggestion: 'Choose another Folder name.',
    });
  });

  it('deletes a Project with its exact confirmation and runtime token', async () => {
    const report = {
      projectName: 'the-glass-harbor',
      projectPath: '/tmp/renku/the-glass-harbor',
      deleted: true,
    };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ report }),
    } as Response);

    await expect(
      deleteProject('the-glass-harbor', 'the-glass-harbor')
    ).resolves.toEqual(report);
    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/projects/the-glass-harbor',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'token-123',
        },
        body: JSON.stringify({
          confirmationProjectName: 'the-glass-harbor',
        }),
      }
    );
  });

  it('rejects a successful deletion response without a report', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await expect(
      deleteProject('missing-report', 'missing-report')
    ).rejects.toThrow('Renku Studio API returned no Project deletion report.');
  });

  it('reads and replaces the complete Project Settings document', async () => {
    const settings = projectSettings();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: {
            project: { id: 'project_test', name: 'constantinople' },
            settings,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: {
            project: { id: 'project_test', name: 'constantinople' },
            settings,
          },
          resourceKeys: ['project-settings'],
        }),
      } as Response);

    await readProjectSettings('constantinople');
    await replaceProjectSettings('constantinople', settings);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/studio-api/projects/constantinople/settings',
      { headers: { 'X-Renku-Studio-Token': 'token-123' } }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/studio-api/projects/constantinople/settings',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'token-123',
        },
        body: JSON.stringify(settings),
      }
    );
  });
});

function projectSettings() {
  return {
    version: 2 as const,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      preferCodexImageGeneration: true,
      displayPreview: true,
      renkuManaged: {
        requirePerRunConfirmation: true,
        allowConcurrentGenerations: false,
        maxConcurrentGenerations: 1,
      },
      codexBuiltIn: {
        requirePerRunConfirmation: false,
        allowConcurrentGenerations: true,
        maxConcurrentGenerations: 5,
      },
    },
  };
}
