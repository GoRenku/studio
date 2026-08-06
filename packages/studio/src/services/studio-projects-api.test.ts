// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
    version: 1 as const,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeatSheets: false,
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
